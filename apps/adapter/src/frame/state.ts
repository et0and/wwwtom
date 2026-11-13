import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import {
  defaultFrameState,
  FrameModeSchema,
  type FrameMode,
  type FrameState,
  type FrameStateUpdate,
  type GavinFrameState,
} from "@tom/schemas/frame-state";
import { GavinMoodSchema, type GavinMood } from "@tom/schemas/gavin";
import type { ResolvedCloudflareEnv } from "@tom/utils/config";
import { AdapterError } from "../runtime";

/**
 * The mode document and Gavin's mood live under one key each. Cloudflare KV
 * has no compare-and-swap and no multi-key transaction, so a mood write that
 * read-modify-wrote the whole document could overwrite a mode change that
 * landed between its read and its write. One key per writer means concurrent
 * mode and mood writes cannot clobber each other; within one key the last
 * write still wins. A read spans both keys and KV is eventually consistent,
 * so it can observe a mode from one instant with a mood from another. That
 * window is the guarantee — not an atomic snapshot.
 */
const FRAME_STATE_KEY = "state";
const GAVIN_MOOD_KEY = "gavin-mood";

const EPOCH = new Date(0).toISOString();

/**
 * Stored mode document. `gavinMood` is deliberately absent: the mood key is
 * the only place a mood is written. A stored mode this build does not know
 * (a retired mode, or a future one) reads as deck while keeping the channel;
 * fields from older documents, such as `streamUrl` and `gavinMood`, are
 * ignored — the mood key is the only mood source.
 */
const StoredFrameStateSchema = Schema.Struct({
  mode: Schema.String,
  channel: Schema.NullOr(Schema.NonEmptyString),
  updatedAt: Schema.String,
});

interface StoredFrameState {
  readonly mode: FrameMode;
  readonly channel: FrameState["channel"];
  readonly updatedAt: string;
}

const GavinMoodRecordSchema = Schema.Struct({
  mood: GavinMoodSchema,
  updatedAt: Schema.String,
});

type GavinMoodRecord = typeof GavinMoodRecordSchema.Type;

const storageUnavailable = (): AdapterError =>
  new AdapterError({
    status: HttpStatus.ServiceUnavailable,
    message: "Frame state storage not configured",
  });

const readKey = (
  env: ResolvedCloudflareEnv,
  key: string,
): Effect.Effect<string | null, AdapterError> => {
  const kv = env.FRAME_KV;
  if (kv === undefined) return Effect.fail(storageUnavailable());
  return Effect.tryPromise({
    try: () => kv.get(key),
    catch: () =>
      new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Failed to read frame state",
      }),
  });
};

const writeKey = (
  env: ResolvedCloudflareEnv,
  key: string,
  value: string,
): Effect.Effect<void, AdapterError> => {
  const kv = env.FRAME_KV;
  if (kv === undefined) return Effect.fail(storageUnavailable());
  return Effect.tryPromise({
    try: () => kv.put(key, value),
    catch: () =>
      new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Failed to write frame state",
      }),
  });
};

const decodeFrameMode = (value: string): FrameMode =>
  Option.getOrElse(Schema.decodeUnknownOption(FrameModeSchema)(value), () => "deck");

const decodeStoredFrameState = (raw: string): StoredFrameState | null => {
  const stored = Option.getOrNull(
    Schema.decodeOption(Schema.fromJsonString(StoredFrameStateSchema))(raw),
  );
  if (stored === null) return null;
  return {
    mode: decodeFrameMode(stored.mode),
    channel: stored.channel,
    updatedAt: stored.updatedAt,
  };
};

const readFrameDocument = (
  env: ResolvedCloudflareEnv,
): Effect.Effect<StoredFrameState, AdapterError> =>
  Effect.gen(function* () {
    const raw = yield* readKey(env, FRAME_STATE_KEY);
    if (raw === null) return defaultFrameState(EPOCH);
    return decodeStoredFrameState(raw) ?? defaultFrameState(EPOCH);
  });

const readGavinMood = (
  env: ResolvedCloudflareEnv,
): Effect.Effect<GavinMoodRecord | null, AdapterError> =>
  Effect.gen(function* () {
    const raw = yield* readKey(env, GAVIN_MOOD_KEY);
    if (raw === null) return null;
    return Option.getOrNull(Schema.decodeOption(Schema.fromJsonString(GavinMoodRecordSchema))(raw));
  });

/** Timestamps are ISO-8601 UTC strings, so lexical order is time order. */
const laterTimestamp = (left: string, right: string): string => (left >= right ? left : right);

const stateForUpdate = (
  update: FrameStateUpdate,
  gavinMood: GavinMood,
  updatedAt: string,
): FrameState =>
  update.mode === "gavin"
    ? { mode: "gavin", channel: update.channel, gavinMood, updatedAt }
    : { mode: update.mode, channel: update.channel, updatedAt };

export const readFrameState = (
  env: ResolvedCloudflareEnv,
): Effect.Effect<FrameState, AdapterError> =>
  Effect.gen(function* () {
    const state = yield* readFrameDocument(env);
    if (state.mode !== "gavin") {
      return { mode: state.mode, channel: state.channel, updatedAt: state.updatedAt };
    }
    const mood = yield* readGavinMood(env);
    return {
      mode: "gavin",
      channel: state.channel,
      gavinMood: mood?.mood ?? "idle",
      updatedAt: laterTimestamp(state.updatedAt, mood?.updatedAt ?? state.updatedAt),
    };
  });

/**
 * Writes the mode document only. Reading the mood when Gavin is selected is
 * for the response body, not a read-modify-write: the mood key is untouched,
 * so a mood update racing this write survives.
 */
export const saveFrameUpdate = (
  env: ResolvedCloudflareEnv,
  update: FrameStateUpdate,
): Effect.Effect<FrameState, AdapterError> =>
  Effect.gen(function* () {
    const mood = update.mode === "gavin" ? yield* readGavinMood(env) : null;
    const updatedAt = new Date().toISOString();
    const document: StoredFrameState = {
      mode: update.mode,
      channel: update.channel,
      updatedAt,
    };
    yield* writeKey(env, FRAME_STATE_KEY, JSON.stringify(document));
    return stateForUpdate(update, mood?.mood ?? "idle", updatedAt);
  });

/**
 * Writes the mood key only, and only after a point-in-time check that Gavin
 * is active. A mode change that lands between the check and the write leaves
 * an unread mood; readers ignore it outside Gavin mode, so the mode change is
 * never lost.
 */
export const saveGavinMood = (
  env: ResolvedCloudflareEnv,
  mood: GavinMood,
): Effect.Effect<GavinFrameState, AdapterError> =>
  Effect.gen(function* () {
    const state = yield* readFrameDocument(env);
    if (state.mode !== "gavin") {
      return yield* new AdapterError({
        status: HttpStatus.Conflict,
        message: "Gavin mode is not active",
      });
    }
    const updatedAt = new Date().toISOString();
    const record: GavinMoodRecord = { mood, updatedAt };
    yield* writeKey(env, GAVIN_MOOD_KEY, JSON.stringify(record));
    return { mode: "gavin", channel: state.channel, gavinMood: mood, updatedAt };
  });
