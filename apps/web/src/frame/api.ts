import { HttpStatus } from "@tom/constants/http";
import {
  FrameStateSchema,
  GavinFrameStateSchema,
  type FrameState,
  type FrameStateUpdate,
  type GavinFrameState,
} from "@tom/schemas/frame-state";
import { GavinReplySchema, type GavinMood, type GavinReply } from "@tom/schemas/gavin";
import { HttpError } from "@tom/types/errors";
import { Option, Schema } from "effect";
import { getAdapterBaseUrl } from "~/data/adapter";

const SessionSchema = Schema.Struct({
  user: Schema.Struct({
    email: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
export type FrameSession = typeof SessionSchema.Type;

const SignInResponseSchema = Schema.Struct({ url: Schema.String });

const ProblemSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  detail: Schema.optional(Schema.String),
});

export const FRAME_SESSION_QUERY_KEY = ["frame-session"] as const;
export const FRAME_STATE_QUERY_KEY = ["frame-state"] as const;

const request = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${getAdapterBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
  });

const problemFor = async (response: Response): Promise<HttpError> => {
  const body = await response.text();
  const json = Option.getOrNull(
    Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Json))(body),
  );
  const problem = Option.getOrNull(Schema.decodeUnknownOption(ProblemSchema)(json));
  return new HttpError({
    message: problem?.title ?? problem?.detail ?? `Request failed (${response.status})`,
    status: response.status,
  });
};

const decodeOrThrow = <A, I, J>(schema: Schema.Codec<A, I>, json: J, message: string): A => {
  const decoded = Schema.decodeUnknownOption(schema)(json);
  if (Option.isNone(decoded)) {
    throw new HttpError({ message, status: HttpStatus.BadGateway });
  }
  return decoded.value;
};

const fetchJson = async <A, I>(
  path: string,
  init: RequestInit | undefined,
  schema: Schema.Codec<A, I>,
  message: string,
): Promise<A> => {
  const response = await request(path, init);
  if (!response.ok) throw await problemFor(response);
  const json: unknown = await response.json();
  return decodeOrThrow(schema, json, message);
};

export const loadFrameSession = async (): Promise<FrameSession | null> => {
  const response = await request("/auth/get-session");
  if (response.status === HttpStatus.Unauthorized) return null;
  if (!response.ok) throw await problemFor(response);
  const json: unknown = await response.json();
  return decodeOrThrow(
    Schema.NullOr(SessionSchema),
    json,
    "The adapter returned an invalid session",
  );
};

export const loadFrameState = (): Promise<FrameState> =>
  fetchJson(
    "/frame/state",
    undefined,
    FrameStateSchema,
    "The adapter returned an invalid frame state",
  );

export const saveFrameState = (update: FrameStateUpdate): Promise<FrameState> =>
  fetchJson(
    "/frame/state",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    },
    FrameStateSchema,
    "The adapter returned an invalid frame state",
  );

export const setGavinMood = (mood: GavinMood): Promise<GavinFrameState> =>
  fetchJson(
    "/frame/gavin",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood }),
    },
    GavinFrameStateSchema,
    "The adapter returned an invalid Gavin state",
  );

export const askGavin = (transcript: string): Promise<GavinReply> =>
  fetchJson(
    "/gavin/respond",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    },
    GavinReplySchema,
    "The adapter returned an invalid Gavin reply",
  );

export const startSignIn = async (): Promise<void> => {
  const result = await fetchJson(
    "/auth/sign-in/social",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        callbackURL: `${window.location.origin}/frame`,
        disableRedirect: true,
      }),
    },
    SignInResponseSchema,
    "The adapter returned an invalid sign-in response",
  );
  const url = Option.getOrNull(Schema.decodeUnknownOption(Schema.URLFromString)(result.url));
  if (url === null || url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new HttpError({
      message: "The adapter returned an untrusted sign-in URL",
      status: HttpStatus.BadGateway,
    });
  }
  window.location.assign(url.href);
};

export const signOut = async (): Promise<void> => {
  const response = await request("/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw await problemFor(response);
};

export const errorMessage = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  if (Schema.is(HttpError)(cause)) return cause.message;
  return "Something went wrong";
};
