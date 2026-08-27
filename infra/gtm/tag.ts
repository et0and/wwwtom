import * as Effect from "effect/Effect";
import { Unowned } from "alchemy/AdoptPolicy";
import { deepEqual, isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { GtmHttp } from "./http.ts";
import { augmentNotes, buildMarker, isOwnedMarker, stripMarker } from "./ownership.ts";
import type { Tag as TagSchema, TagDraft } from "./schemas.ts";

export type TagProps = {
  readonly workspacePath: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: TagDraft["parameter"];
  readonly firingTriggerId?: readonly string[];
  readonly blockingTriggerId?: readonly string[];
  readonly setupTag?: TagDraft["setupTag"];
  readonly teardownTag?: TagDraft["teardownTag"];
  readonly parentFolderId?: string;
  readonly tagFiringOption?: TagDraft["tagFiringOption"];
  readonly paused?: boolean;
  readonly notes?: string;
  readonly scheduleStartMs?: string;
  readonly scheduleEndMs?: string;
  readonly liveOnly?: boolean;
  readonly priority?: TagDraft["priority"];
  readonly consentSettings?: TagDraft["consentSettings"];
};

export type TagAttributes = {
  readonly accountId: string;
  readonly containerId: string;
  readonly workspaceId: string;
  readonly tagId: string;
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: TagDraft["parameter"];
  readonly firingTriggerId?: readonly string[];
  readonly blockingTriggerId?: readonly string[];
  readonly setupTag?: TagDraft["setupTag"];
  readonly teardownTag?: TagDraft["teardownTag"];
  readonly parentFolderId?: string;
  readonly tagFiringOption?: TagProps["tagFiringOption"];
  readonly paused?: boolean;
  readonly notes: string;
  readonly scheduleStartMs?: string;
  readonly scheduleEndMs?: string;
  readonly liveOnly?: boolean;
  readonly priority?: TagDraft["priority"];
  readonly consentSettings?: TagDraft["consentSettings"];
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
};

export interface Tag extends Resource<"Gtm.Tag", TagProps, TagAttributes> {}

export const Tag = Resource<Tag>("Gtm.Tag");

const parentOf = (path: string): string => path.split("/tags/")[0] ?? "";

const toAttrs = (t: TagSchema, notesWithoutMarker: string): TagAttributes =>
  ({
    ...t,
    notes: notesWithoutMarker,
    fingerprint: t.fingerprint ?? "",
    tagManagerUrl: t.tagManagerUrl ?? "",
  }) as TagAttributes;

const tagOldNotes = (output: TagAttributes | undefined, oldNotes: string | undefined): string =>
  output ? stripMarker(output.notes) : (oldNotes ?? "");

const preferOld = <T>(oldVal: T | undefined, outputVal: T | undefined): T | undefined =>
  oldVal ?? outputVal;

const preferOutput = <T>(outputVal: T | undefined, oldVal: T | undefined): T | undefined =>
  outputVal ?? oldVal;

const buildTagOldComparable = (output: TagAttributes | undefined, o: Partial<TagProps>) => ({
  notes: tagOldNotes(output, o.notes),
  name: preferOutput(output?.name, o.name),
  type: preferOutput(output?.type, o.type),
  parameter: preferOld(o.parameter, output?.parameter),
  firingTriggerId: preferOld(o.firingTriggerId, output?.firingTriggerId),
  blockingTriggerId: preferOld(o.blockingTriggerId, output?.blockingTriggerId),
  setupTag: preferOld(o.setupTag, output?.setupTag),
  teardownTag: preferOld(o.teardownTag, output?.teardownTag),
  parentFolderId: preferOld(o.parentFolderId, output?.parentFolderId),
  tagFiringOption: preferOld(o.tagFiringOption, output?.tagFiringOption),
  paused: preferOld(o.paused, output?.paused),
  scheduleStartMs: preferOld(o.scheduleStartMs, output?.scheduleStartMs),
  scheduleEndMs: preferOld(o.scheduleEndMs, output?.scheduleEndMs),
  liveOnly: preferOld(o.liveOnly, output?.liveOnly),
  priority: preferOld(o.priority, output?.priority),
  consentSettings: preferOld(o.consentSettings, output?.consentSettings),
});

const buildTagNewComparable = (news: TagProps) => ({
  notes: news.notes ?? "",
  name: news.name,
  type: news.type,
  parameter: news.parameter,
  firingTriggerId: news.firingTriggerId,
  blockingTriggerId: news.blockingTriggerId,
  setupTag: news.setupTag,
  teardownTag: news.teardownTag,
  parentFolderId: news.parentFolderId,
  tagFiringOption: news.tagFiringOption,
  paused: news.paused,
  scheduleStartMs: news.scheduleStartMs,
  scheduleEndMs: news.scheduleEndMs,
  liveOnly: news.liveOnly,
  priority: news.priority,
  consentSettings: news.consentSettings,
});

const isTagNeedsUpdate = (
  observed: TagSchema,
  news: TagProps,
  observedNotesStripped: string,
  desiredNotes: string,
): boolean =>
  [
    observed.name !== news.name,
    observed.type !== news.type,
    observedNotesStripped !== stripMarker(news.notes ?? ""),
    !deepEqual(observed.parameter, news.parameter),
    !deepEqual(observed.firingTriggerId, news.firingTriggerId),
    !deepEqual(observed.blockingTriggerId, news.blockingTriggerId),
    !deepEqual(observed.setupTag, news.setupTag),
    !deepEqual(observed.teardownTag, news.teardownTag),
    observed.parentFolderId !== news.parentFolderId,
    observed.tagFiringOption !== news.tagFiringOption,
    observed.paused !== news.paused,
    observed.scheduleStartMs !== news.scheduleStartMs,
    observed.scheduleEndMs !== news.scheduleEndMs,
    observed.liveOnly !== news.liveOnly,
    !deepEqual(observed.priority, news.priority),
    !deepEqual(observed.consentSettings, news.consentSettings),
    observed.notes !== desiredNotes,
  ].some(Boolean);

export const TagProvider = () =>
  Provider.effect(
    Tag as ResourceClassLike<Tag>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (workspacePath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listTags(workspacePath);
          const list = res.tag ?? [];
          return list.find((t) => t.name === name);
        });

      return {
        list: () => Effect.succeed([] as TagAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<TagProps> = olds ?? {};

            const oldParent = output ? parentOf(output.path) : o.workspacePath;
            if (oldParent !== undefined && news.workspacePath !== oldParent) {
              return { action: "replace" } as const;
            }

            const oldComparable = buildTagOldComparable(output, o);
            const newComparable = buildTagNewComparable(news);
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<TagProps> = olds ?? {};
          const workspacePath = output ? parentOf(output.path) : o.workspacePath;
          const name = output?.name ?? o.name;
          if (!workspacePath || !name) return undefined;

          const existing = yield* findByName(workspacePath, name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );
          if (!existing) return undefined;

          const attrs = toAttrs(existing, stripMarker(existing.notes));
          return isOwnedMarker(existing.notes, stack.name, stage, id) ? attrs : Unowned(attrs);
        }),

        reconcile: Effect.fn(function* ({ id, news }) {
          const desiredNotes = augmentNotes(news.notes, buildMarker(stack.name, stage, id));
          const { workspacePath, ...rest } = news;
          const draft: TagDraft = { ...rest, notes: desiredNotes };

          const observed = yield* findByName(workspacePath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createTag(workspacePath, draft);
            return toAttrs(created, stripMarker(created.notes));
          }

          const observedNotesStripped = stripMarker(observed.notes);
          const needsUpdate = isTagNeedsUpdate(observed, news, observedNotesStripped, desiredNotes);

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody: TagDraft = { ...draft, fingerprint: observed.fingerprint };
          const updated = yield* http.updateTag(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http.deleteTag(output.path).pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Tag>;
    }),
  );
