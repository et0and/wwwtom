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
import type {
  ConsentSettings,
  Parameter,
  SetupTag,
  Tag as TagSchema,
  TeardownTag,
} from "./schemas.ts";

export type TagProps = {
  workspacePath: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  setupTag?: SetupTag[];
  teardownTag?: TeardownTag[];
  parentFolderId?: string;
  tagFiringOption?: "oncePerEvent" | "oncePerLoad" | "unlimited" | "tagFiringOptionUnspecified";
  paused?: boolean;
  notes?: string;
  scheduleStartMs?: string;
  scheduleEndMs?: string;
  liveOnly?: boolean;
  priority?: Parameter;
  consentSettings?: ConsentSettings;
};

export type TagAttributes = {
  accountId: string;
  containerId: string;
  workspaceId: string;
  tagId: string;
  path: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  setupTag?: SetupTag[];
  teardownTag?: TeardownTag[];
  parentFolderId?: string;
  tagFiringOption?: TagProps["tagFiringOption"];
  paused?: boolean;
  notes: string;
  scheduleStartMs?: string;
  scheduleEndMs?: string;
  liveOnly?: boolean;
  priority?: Parameter;
  consentSettings?: ConsentSettings;
  fingerprint: string;
  tagManagerUrl: string;
};

export interface Tag extends Resource<"Gtm.Tag", TagProps, TagAttributes> {}

export const Tag = Resource<Tag>("Gtm.Tag");

const parentOf = (path: string): string => path.split("/tags/")[0] ?? "";

const toAttrs = (t: TagSchema, notesWithoutMarker: string): TagAttributes => {
  const attrs: TagAttributes = {
    accountId: t.accountId,
    containerId: t.containerId,
    workspaceId: t.workspaceId,
    tagId: t.tagId,
    path: t.path,
    name: t.name,
    type: t.type,
    notes: notesWithoutMarker,
    fingerprint: t.fingerprint ?? "",
    tagManagerUrl: t.tagManagerUrl ?? "",
  };
  if (t.parameter !== undefined) attrs.parameter = t.parameter;
  if (t.firingTriggerId !== undefined) attrs.firingTriggerId = t.firingTriggerId;
  if (t.blockingTriggerId !== undefined) attrs.blockingTriggerId = t.blockingTriggerId;
  if (t.setupTag !== undefined) attrs.setupTag = t.setupTag;
  if (t.teardownTag !== undefined) attrs.teardownTag = t.teardownTag;
  if (t.parentFolderId !== undefined) attrs.parentFolderId = t.parentFolderId;
  if (t.tagFiringOption !== undefined) attrs.tagFiringOption = t.tagFiringOption;
  if (t.paused !== undefined) attrs.paused = t.paused;
  if (t.scheduleStartMs !== undefined) attrs.scheduleStartMs = t.scheduleStartMs;
  if (t.scheduleEndMs !== undefined) attrs.scheduleEndMs = t.scheduleEndMs;
  if (t.liveOnly !== undefined) attrs.liveOnly = t.liveOnly;
  if (t.priority !== undefined) attrs.priority = t.priority;
  if (t.consentSettings !== undefined) attrs.consentSettings = t.consentSettings;
  return attrs;
};

const withOptionalProps = (body: Partial<TagSchema>, props: TagProps): Partial<TagSchema> => {
  if (props.parameter !== undefined) body.parameter = props.parameter;
  if (props.firingTriggerId !== undefined) body.firingTriggerId = props.firingTriggerId;
  if (props.blockingTriggerId !== undefined) body.blockingTriggerId = props.blockingTriggerId;
  if (props.setupTag !== undefined) body.setupTag = props.setupTag;
  if (props.teardownTag !== undefined) body.teardownTag = props.teardownTag;
  if (props.parentFolderId !== undefined) body.parentFolderId = props.parentFolderId;
  if (props.tagFiringOption !== undefined) body.tagFiringOption = props.tagFiringOption;
  if (props.paused !== undefined) body.paused = props.paused;
  if (props.scheduleStartMs !== undefined) body.scheduleStartMs = props.scheduleStartMs;
  if (props.scheduleEndMs !== undefined) body.scheduleEndMs = props.scheduleEndMs;
  if (props.liveOnly !== undefined) body.liveOnly = props.liveOnly;
  if (props.priority !== undefined) body.priority = props.priority;
  if (props.consentSettings !== undefined) body.consentSettings = props.consentSettings;
  return body;
};

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

            const oldNotes = output ? stripMarker(output.notes) : (o.notes ?? "");
            if (oldNotes !== (news.notes ?? "")) return { action: "update" } as const;
            if (output && news.name !== output.name) return { action: "update" } as const;
            if (output && news.type !== output.type) return { action: "update" } as const;
            if (!deepEqual(o.parameter ?? output?.parameter, news.parameter))
              return { action: "update" } as const;
            if (!deepEqual(o.firingTriggerId ?? output?.firingTriggerId, news.firingTriggerId))
              return { action: "update" } as const;
            if (
              !deepEqual(o.blockingTriggerId ?? output?.blockingTriggerId, news.blockingTriggerId)
            )
              return { action: "update" } as const;
            if (!deepEqual(o.setupTag ?? output?.setupTag, news.setupTag))
              return { action: "update" } as const;
            if (!deepEqual(o.teardownTag ?? output?.teardownTag, news.teardownTag))
              return { action: "update" } as const;
            if ((o.parentFolderId ?? output?.parentFolderId) !== news.parentFolderId)
              return { action: "update" } as const;
            if ((o.tagFiringOption ?? output?.tagFiringOption) !== news.tagFiringOption)
              return { action: "update" } as const;
            if ((o.paused ?? output?.paused) !== news.paused) return { action: "update" } as const;
            if ((o.scheduleStartMs ?? output?.scheduleStartMs) !== news.scheduleStartMs)
              return { action: "update" } as const;
            if ((o.scheduleEndMs ?? output?.scheduleEndMs) !== news.scheduleEndMs)
              return { action: "update" } as const;
            if ((o.liveOnly ?? output?.liveOnly) !== news.liveOnly)
              return { action: "update" } as const;
            if (!deepEqual(o.priority ?? output?.priority, news.priority))
              return { action: "update" } as const;
            if (!deepEqual(o.consentSettings ?? output?.consentSettings, news.consentSettings))
              return { action: "update" } as const;
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

          const observed = yield* findByName(news.workspacePath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createTag(
              news.workspacePath,
              withOptionalProps({ name: news.name, type: news.type, notes: desiredNotes }, news),
            );
            return toAttrs(created, stripMarker(created.notes));
          }

          const observedNotesStripped = stripMarker(observed.notes);
          const needsUpdate =
            observed.name !== news.name ||
            observed.type !== news.type ||
            observedNotesStripped !== stripMarker(news.notes ?? "") ||
            !deepEqual(observed.parameter, news.parameter) ||
            !deepEqual(observed.firingTriggerId, news.firingTriggerId) ||
            !deepEqual(observed.blockingTriggerId, news.blockingTriggerId) ||
            !deepEqual(observed.setupTag, news.setupTag) ||
            !deepEqual(observed.teardownTag, news.teardownTag) ||
            observed.parentFolderId !== news.parentFolderId ||
            observed.tagFiringOption !== news.tagFiringOption ||
            observed.paused !== news.paused ||
            observed.scheduleStartMs !== news.scheduleStartMs ||
            observed.scheduleEndMs !== news.scheduleEndMs ||
            observed.liveOnly !== news.liveOnly ||
            !deepEqual(observed.priority, news.priority) ||
            !deepEqual(observed.consentSettings, news.consentSettings) ||
            observed.notes !== desiredNotes;

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody = withOptionalProps(
            { name: news.name, type: news.type, notes: desiredNotes },
            news,
          );
          if (observed.fingerprint !== undefined) updateBody.fingerprint = observed.fingerprint;
          const updated = yield* http.updateTag(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http.deleteTag(output.path).pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Tag>;
    }),
  );
