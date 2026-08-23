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
import type { Condition, Parameter, Trigger as TriggerSchema } from "./schemas.ts";

export type TriggerProps = {
  workspacePath: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  filter?: Condition[];
  customEventFilter?: Condition[];
  parentFolderId?: string;
  notes?: string;
};

export type TriggerAttributes = {
  accountId: string;
  containerId: string;
  workspaceId: string;
  triggerId: string;
  path: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  filter?: Condition[];
  customEventFilter?: Condition[];
  parentFolderId?: string;
  notes: string;
  fingerprint: string;
  tagManagerUrl: string;
};

export interface Trigger extends Resource<"Gtm.Trigger", TriggerProps, TriggerAttributes> {}

export const Trigger = Resource<Trigger>("Gtm.Trigger");

const parentOf = (path: string): string => path.split("/triggers/")[0] ?? "";

const toAttrs = (t: TriggerSchema, notesWithoutMarker: string): TriggerAttributes => {
  const attrs: TriggerAttributes = {
    accountId: t.accountId,
    containerId: t.containerId,
    workspaceId: t.workspaceId,
    triggerId: t.triggerId,
    path: t.path,
    name: t.name,
    type: t.type,
    notes: notesWithoutMarker,
    fingerprint: t.fingerprint ?? "",
    tagManagerUrl: t.tagManagerUrl ?? "",
  };
  if (t.parameter !== undefined) attrs.parameter = t.parameter;
  if (t.filter !== undefined) attrs.filter = t.filter;
  if (t.customEventFilter !== undefined) attrs.customEventFilter = t.customEventFilter;
  if (t.parentFolderId !== undefined) attrs.parentFolderId = t.parentFolderId;
  return attrs;
};

const withOptionalProps = (
  body: Partial<TriggerSchema>,
  props: TriggerProps,
): Partial<TriggerSchema> => {
  if (props.parameter !== undefined) body.parameter = props.parameter;
  if (props.filter !== undefined) body.filter = props.filter;
  if (props.customEventFilter !== undefined) body.customEventFilter = props.customEventFilter;
  if (props.parentFolderId !== undefined) body.parentFolderId = props.parentFolderId;
  return body;
};

export const TriggerProvider = () =>
  Provider.effect(
    Trigger as ResourceClassLike<Trigger>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (workspacePath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listTriggers(workspacePath);
          const list = res.trigger ?? [];
          return list.find((t) => t.name === name);
        });

      return {
        list: () => Effect.succeed([] as TriggerAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<TriggerProps> = olds ?? {};

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
            if (!deepEqual(o.filter ?? output?.filter, news.filter))
              return { action: "update" } as const;
            if (
              !deepEqual(o.customEventFilter ?? output?.customEventFilter, news.customEventFilter)
            )
              return { action: "update" } as const;
            if ((o.parentFolderId ?? output?.parentFolderId) !== news.parentFolderId)
              return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<TriggerProps> = olds ?? {};
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
            const created = yield* http.createTrigger(
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
            !deepEqual(observed.filter, news.filter) ||
            !deepEqual(observed.customEventFilter, news.customEventFilter) ||
            observed.parentFolderId !== news.parentFolderId ||
            observed.notes !== desiredNotes;

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody = withOptionalProps(
            { name: news.name, type: news.type, notes: desiredNotes },
            news,
          );
          if (observed.fingerprint !== undefined) updateBody.fingerprint = observed.fingerprint;
          const updated = yield* http.updateTrigger(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteTrigger(output.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Trigger>;
    }),
  );
