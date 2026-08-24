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
import type { Trigger as TriggerSchema, TriggerDraft } from "./schemas.ts";

export type TriggerProps = {
  readonly workspacePath: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: TriggerDraft["parameter"];
  readonly filter?: TriggerDraft["filter"];
  readonly customEventFilter?: TriggerDraft["customEventFilter"];
  readonly autoEventFilter?: TriggerDraft["autoEventFilter"];
  readonly parentFolderId?: string;
  readonly notes?: string;
  readonly waitForTags?: TriggerDraft["waitForTags"];
  readonly checkValidation?: TriggerDraft["checkValidation"];
  readonly waitForTagsTimeout?: TriggerDraft["waitForTagsTimeout"];
  readonly uniqueTriggerId?: TriggerDraft["uniqueTriggerId"];
  readonly eventName?: TriggerDraft["eventName"];
  readonly interval?: TriggerDraft["interval"];
  readonly limit?: TriggerDraft["limit"];
  readonly selector?: TriggerDraft["selector"];
  readonly intervalSeconds?: TriggerDraft["intervalSeconds"];
  readonly maxTimerLengthSeconds?: TriggerDraft["maxTimerLengthSeconds"];
  readonly verticalScrollPercentageList?: TriggerDraft["verticalScrollPercentageList"];
  readonly horizontalScrollPercentageList?: TriggerDraft["horizontalScrollPercentageList"];
  readonly visibilitySelector?: TriggerDraft["visibilitySelector"];
  readonly visiblePercentageMin?: TriggerDraft["visiblePercentageMin"];
  readonly visiblePercentageMax?: TriggerDraft["visiblePercentageMax"];
  readonly continuousTimeMinMilliseconds?: TriggerDraft["continuousTimeMinMilliseconds"];
  readonly totalTimeMinMilliseconds?: TriggerDraft["totalTimeMinMilliseconds"];
};

export type TriggerAttributes = {
  readonly accountId: string;
  readonly containerId: string;
  readonly workspaceId: string;
  readonly triggerId: string;
  readonly path: string;
  readonly name: string;
  readonly type: string;
  readonly parameter?: TriggerDraft["parameter"];
  readonly filter?: TriggerDraft["filter"];
  readonly customEventFilter?: TriggerDraft["customEventFilter"];
  readonly autoEventFilter?: TriggerDraft["autoEventFilter"];
  readonly parentFolderId?: string;
  readonly notes: string;
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
  readonly waitForTags?: TriggerDraft["waitForTags"];
  readonly checkValidation?: TriggerDraft["checkValidation"];
  readonly waitForTagsTimeout?: TriggerDraft["waitForTagsTimeout"];
  readonly uniqueTriggerId?: TriggerDraft["uniqueTriggerId"];
  readonly eventName?: TriggerDraft["eventName"];
  readonly interval?: TriggerDraft["interval"];
  readonly limit?: TriggerDraft["limit"];
  readonly selector?: TriggerDraft["selector"];
  readonly intervalSeconds?: TriggerDraft["intervalSeconds"];
  readonly maxTimerLengthSeconds?: TriggerDraft["maxTimerLengthSeconds"];
  readonly verticalScrollPercentageList?: TriggerDraft["verticalScrollPercentageList"];
  readonly horizontalScrollPercentageList?: TriggerDraft["horizontalScrollPercentageList"];
  readonly visibilitySelector?: TriggerDraft["visibilitySelector"];
  readonly visiblePercentageMin?: TriggerDraft["visiblePercentageMin"];
  readonly visiblePercentageMax?: TriggerDraft["visiblePercentageMax"];
  readonly continuousTimeMinMilliseconds?: TriggerDraft["continuousTimeMinMilliseconds"];
  readonly totalTimeMinMilliseconds?: TriggerDraft["totalTimeMinMilliseconds"];
};

export interface Trigger extends Resource<"Gtm.Trigger", TriggerProps, TriggerAttributes> {}

export const Trigger = Resource<Trigger>("Gtm.Trigger");

const parentOf = (path: string): string => path.split("/triggers/")[0] ?? "";

const toAttrs = (t: TriggerSchema, notesWithoutMarker: string): TriggerAttributes =>
  ({
    ...t,
    notes: notesWithoutMarker,
    fingerprint: t.fingerprint ?? "",
    tagManagerUrl: t.tagManagerUrl ?? "",
  }) as TriggerAttributes;

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

            const oldComparable = {
              notes: output ? stripMarker(output.notes) : (o.notes ?? ""),
              name: output?.name ?? o.name,
              type: output?.type ?? o.type,
              parameter: o.parameter ?? output?.parameter,
              filter: o.filter ?? output?.filter,
              customEventFilter: o.customEventFilter ?? output?.customEventFilter,
              autoEventFilter: o.autoEventFilter ?? output?.autoEventFilter,
              parentFolderId: o.parentFolderId ?? output?.parentFolderId,
              waitForTags: o.waitForTags ?? output?.waitForTags,
              checkValidation: o.checkValidation ?? output?.checkValidation,
              waitForTagsTimeout: o.waitForTagsTimeout ?? output?.waitForTagsTimeout,
              uniqueTriggerId: o.uniqueTriggerId ?? output?.uniqueTriggerId,
              eventName: o.eventName ?? output?.eventName,
              interval: o.interval ?? output?.interval,
              limit: o.limit ?? output?.limit,
              selector: o.selector ?? output?.selector,
              intervalSeconds: o.intervalSeconds ?? output?.intervalSeconds,
              maxTimerLengthSeconds: o.maxTimerLengthSeconds ?? output?.maxTimerLengthSeconds,
              verticalScrollPercentageList:
                o.verticalScrollPercentageList ?? output?.verticalScrollPercentageList,
              horizontalScrollPercentageList:
                o.horizontalScrollPercentageList ?? output?.horizontalScrollPercentageList,
              visibilitySelector: o.visibilitySelector ?? output?.visibilitySelector,
              visiblePercentageMin: o.visiblePercentageMin ?? output?.visiblePercentageMin,
              visiblePercentageMax: o.visiblePercentageMax ?? output?.visiblePercentageMax,
              continuousTimeMinMilliseconds:
                o.continuousTimeMinMilliseconds ?? output?.continuousTimeMinMilliseconds,
              totalTimeMinMilliseconds:
                o.totalTimeMinMilliseconds ?? output?.totalTimeMinMilliseconds,
            };
            const newComparable = {
              notes: news.notes ?? "",
              name: news.name,
              type: news.type,
              parameter: news.parameter,
              filter: news.filter,
              customEventFilter: news.customEventFilter,
              autoEventFilter: news.autoEventFilter,
              parentFolderId: news.parentFolderId,
              waitForTags: news.waitForTags,
              checkValidation: news.checkValidation,
              waitForTagsTimeout: news.waitForTagsTimeout,
              uniqueTriggerId: news.uniqueTriggerId,
              eventName: news.eventName,
              interval: news.interval,
              limit: news.limit,
              selector: news.selector,
              intervalSeconds: news.intervalSeconds,
              maxTimerLengthSeconds: news.maxTimerLengthSeconds,
              verticalScrollPercentageList: news.verticalScrollPercentageList,
              horizontalScrollPercentageList: news.horizontalScrollPercentageList,
              visibilitySelector: news.visibilitySelector,
              visiblePercentageMin: news.visiblePercentageMin,
              visiblePercentageMax: news.visiblePercentageMax,
              continuousTimeMinMilliseconds: news.continuousTimeMinMilliseconds,
              totalTimeMinMilliseconds: news.totalTimeMinMilliseconds,
            };
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
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
          const { workspacePath, ...rest } = news;
          const draft: TriggerDraft = { ...rest, notes: desiredNotes };

          const observed = yield* findByName(workspacePath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createTrigger(workspacePath, draft);
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
            !deepEqual(observed.autoEventFilter, news.autoEventFilter) ||
            observed.parentFolderId !== news.parentFolderId ||
            !deepEqual(observed.waitForTags, news.waitForTags) ||
            !deepEqual(observed.checkValidation, news.checkValidation) ||
            !deepEqual(observed.waitForTagsTimeout, news.waitForTagsTimeout) ||
            !deepEqual(observed.uniqueTriggerId, news.uniqueTriggerId) ||
            !deepEqual(observed.eventName, news.eventName) ||
            !deepEqual(observed.interval, news.interval) ||
            !deepEqual(observed.limit, news.limit) ||
            !deepEqual(observed.selector, news.selector) ||
            !deepEqual(observed.intervalSeconds, news.intervalSeconds) ||
            !deepEqual(observed.maxTimerLengthSeconds, news.maxTimerLengthSeconds) ||
            !deepEqual(observed.verticalScrollPercentageList, news.verticalScrollPercentageList) ||
            !deepEqual(
              observed.horizontalScrollPercentageList,
              news.horizontalScrollPercentageList,
            ) ||
            !deepEqual(observed.visibilitySelector, news.visibilitySelector) ||
            !deepEqual(observed.visiblePercentageMin, news.visiblePercentageMin) ||
            !deepEqual(observed.visiblePercentageMax, news.visiblePercentageMax) ||
            !deepEqual(
              observed.continuousTimeMinMilliseconds,
              news.continuousTimeMinMilliseconds,
            ) ||
            !deepEqual(observed.totalTimeMinMilliseconds, news.totalTimeMinMilliseconds) ||
            observed.notes !== desiredNotes;

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody: TriggerDraft = { ...draft, fingerprint: observed.fingerprint };
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
