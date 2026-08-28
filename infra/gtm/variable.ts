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
import type { Variable as VariableSchema, VariableDraft } from "./schemas.ts";

export type VariableProps = {
  readonly workspacePath: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: VariableDraft["parameter"];
  readonly parentFolderId?: string;
  readonly notes?: string;
  readonly scheduleStartMs?: string;
  readonly scheduleEndMs?: string;
  readonly formatValue?: VariableDraft["formatValue"];
  readonly enablingTriggerId?: readonly string[];
  readonly disablingTriggerId?: readonly string[];
};

export type VariableAttributes = {
  readonly accountId: string;
  readonly containerId: string;
  readonly workspaceId: string;
  readonly variableId: string;
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: VariableDraft["parameter"];
  readonly parentFolderId?: string;
  readonly notes: string;
  readonly scheduleStartMs?: string;
  readonly scheduleEndMs?: string;
  readonly formatValue?: VariableDraft["formatValue"];
  readonly enablingTriggerId?: readonly string[];
  readonly disablingTriggerId?: readonly string[];
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
};

export interface Variable extends Resource<"Gtm.Variable", VariableProps, VariableAttributes> {}

export const Variable = Resource<Variable>("Gtm.Variable");

const parentOf = (path: string): string => path.split("/variables/")[0] ?? "";

const toAttrs = (v: VariableSchema, notesWithoutMarker: string): VariableAttributes =>
  ({
    ...v,
    notes: notesWithoutMarker,
    fingerprint: v.fingerprint ?? "",
    tagManagerUrl: v.tagManagerUrl ?? "",
  }) as VariableAttributes;

const variableOldNotes = (
  output: VariableAttributes | undefined,
  oldNotes: string | undefined,
): string => (output ? stripMarker(output.notes) : (oldNotes ?? ""));

const preferOldVar = <T>(oldVal: T | undefined, outputVal: T | undefined): T | undefined =>
  oldVal ?? outputVal;

const preferOutputVar = <T>(outputVal: T | undefined, oldVal: T | undefined): T | undefined =>
  outputVal ?? oldVal;

const buildVariableOldComparable = (
  output: VariableAttributes | undefined,
  o: Partial<VariableProps>,
) => ({
  notes: variableOldNotes(output, o.notes),
  name: preferOutputVar(output?.name, o.name),
  type: preferOutputVar(output?.type, o.type),
  parameter: preferOldVar(o.parameter, output?.parameter),
  parentFolderId: preferOldVar(o.parentFolderId, output?.parentFolderId),
  scheduleStartMs: preferOldVar(o.scheduleStartMs, output?.scheduleStartMs),
  scheduleEndMs: preferOldVar(o.scheduleEndMs, output?.scheduleEndMs),
  formatValue: preferOldVar(o.formatValue, output?.formatValue),
  enablingTriggerId: preferOldVar(o.enablingTriggerId, output?.enablingTriggerId),
  disablingTriggerId: preferOldVar(o.disablingTriggerId, output?.disablingTriggerId),
});

const buildVariableNewComparable = (news: VariableProps) => ({
  notes: news.notes ?? "",
  name: news.name,
  type: news.type,
  parameter: news.parameter,
  parentFolderId: news.parentFolderId,
  scheduleStartMs: news.scheduleStartMs,
  scheduleEndMs: news.scheduleEndMs,
  formatValue: news.formatValue,
  enablingTriggerId: news.enablingTriggerId,
  disablingTriggerId: news.disablingTriggerId,
});

const isVariableNeedsUpdate = (
  observed: VariableSchema,
  news: VariableProps,
  observedNotesStripped: string,
  desiredNotes: string,
): boolean =>
  [
    observed.name !== news.name,
    observed.type !== news.type,
    observedNotesStripped !== stripMarker(news.notes ?? ""),
    !deepEqual(observed.parameter, news.parameter),
    observed.parentFolderId !== news.parentFolderId,
    observed.scheduleStartMs !== news.scheduleStartMs,
    observed.scheduleEndMs !== news.scheduleEndMs,
    !deepEqual(observed.formatValue, news.formatValue),
    !deepEqual(observed.enablingTriggerId, news.enablingTriggerId),
    !deepEqual(observed.disablingTriggerId, news.disablingTriggerId),
    observed.notes !== desiredNotes,
  ].some(Boolean);

export const VariableProvider = () =>
  Provider.effect(
    Variable as ResourceClassLike<Variable>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (workspacePath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listVariables(workspacePath);
          const list = res.variable ?? [];
          return list.find((x) => x.name === name);
        });

      return {
        list: () => Effect.succeed([] as VariableAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<VariableProps> = olds ?? {};

            const oldParent = output ? parentOf(output.path) : o.workspacePath;
            if (oldParent !== undefined && news.workspacePath !== oldParent) {
              return { action: "replace" } as const;
            }

            const oldComparable = buildVariableOldComparable(output, o);
            const newComparable = buildVariableNewComparable(news);
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<VariableProps> = olds ?? {};
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
          const draft: VariableDraft = { ...rest, notes: desiredNotes };

          const observed = yield* findByName(workspacePath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createVariable(workspacePath, draft);
            return toAttrs(created, stripMarker(created.notes));
          }

          const observedNotesStripped = stripMarker(observed.notes);
          const needsUpdate = isVariableNeedsUpdate(
            observed,
            news,
            observedNotesStripped,
            desiredNotes,
          );

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody: VariableDraft = { ...draft, fingerprint: observed.fingerprint };
          const updated = yield* http.updateVariable(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteVariable(output.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Variable>;
    }),
  );
