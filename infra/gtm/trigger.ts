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

const triggerOldNotes = (
  output: TriggerAttributes | undefined,
  oldNotes: string | undefined,
): string => (output ? stripMarker(output.notes) : (oldNotes ?? ""));

const preferOldTrigger = <T>(oldVal: T | undefined, outputVal: T | undefined): T | undefined =>
  oldVal ?? outputVal;

const preferOutputTrigger = <T>(outputVal: T | undefined, oldVal: T | undefined): T | undefined =>
  outputVal ?? oldVal;

const buildTriggerOldComparable = (
  output: TriggerAttributes | undefined,
  o: Partial<TriggerProps>,
) => {
  const getOut = <K extends keyof TriggerAttributes>(key: K): TriggerAttributes[K] | undefined =>
    output ? output[key] : undefined;
  return {
    notes: triggerOldNotes(output, o.notes),
    name: preferOutputTrigger(getOut("name"), o.name),
    type: preferOutputTrigger(getOut("type"), o.type),
    parameter: preferOldTrigger(o.parameter, getOut("parameter")),
    filter: preferOldTrigger(o.filter, getOut("filter")),
    customEventFilter: preferOldTrigger(o.customEventFilter, getOut("customEventFilter")),
    autoEventFilter: preferOldTrigger(o.autoEventFilter, getOut("autoEventFilter")),
    parentFolderId: preferOldTrigger(o.parentFolderId, getOut("parentFolderId")),
    waitForTags: preferOldTrigger(o.waitForTags, getOut("waitForTags")),
    checkValidation: preferOldTrigger(o.checkValidation, getOut("checkValidation")),
    waitForTagsTimeout: preferOldTrigger(o.waitForTagsTimeout, getOut("waitForTagsTimeout")),
    uniqueTriggerId: preferOldTrigger(o.uniqueTriggerId, getOut("uniqueTriggerId")),
    eventName: preferOldTrigger(o.eventName, getOut("eventName")),
    interval: preferOldTrigger(o.interval, getOut("interval")),
    limit: preferOldTrigger(o.limit, getOut("limit")),
    selector: preferOldTrigger(o.selector, getOut("selector")),
    intervalSeconds: preferOldTrigger(o.intervalSeconds, getOut("intervalSeconds")),
    maxTimerLengthSeconds: preferOldTrigger(
      o.maxTimerLengthSeconds,
      getOut("maxTimerLengthSeconds"),
    ),
    verticalScrollPercentageList: preferOldTrigger(
      o.verticalScrollPercentageList,
      getOut("verticalScrollPercentageList"),
    ),
    horizontalScrollPercentageList: preferOldTrigger(
      o.horizontalScrollPercentageList,
      getOut("horizontalScrollPercentageList"),
    ),
    visibilitySelector: preferOldTrigger(o.visibilitySelector, getOut("visibilitySelector")),
    visiblePercentageMin: preferOldTrigger(o.visiblePercentageMin, getOut("visiblePercentageMin")),
    visiblePercentageMax: preferOldTrigger(o.visiblePercentageMax, getOut("visiblePercentageMax")),
    continuousTimeMinMilliseconds: preferOldTrigger(
      o.continuousTimeMinMilliseconds,
      getOut("continuousTimeMinMilliseconds"),
    ),
    totalTimeMinMilliseconds: preferOldTrigger(
      o.totalTimeMinMilliseconds,
      getOut("totalTimeMinMilliseconds"),
    ),
  };
};

const buildTriggerNewComparable = (news: TriggerProps) => ({
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
});

const isTriggerNeedsUpdate = (
  observed: TriggerSchema,
  news: TriggerProps,
  observedNotesStripped: string,
  desiredNotes: string,
): boolean =>
  [
    observed.name !== news.name,
    observed.type !== news.type,
    observedNotesStripped !== stripMarker(news.notes ?? ""),
    !deepEqual(observed.parameter, news.parameter),
    !deepEqual(observed.filter, news.filter),
    !deepEqual(observed.customEventFilter, news.customEventFilter),
    !deepEqual(observed.autoEventFilter, news.autoEventFilter),
    observed.parentFolderId !== news.parentFolderId,
    !deepEqual(observed.waitForTags, news.waitForTags),
    !deepEqual(observed.checkValidation, news.checkValidation),
    !deepEqual(observed.waitForTagsTimeout, news.waitForTagsTimeout),
    !deepEqual(observed.uniqueTriggerId, news.uniqueTriggerId),
    !deepEqual(observed.eventName, news.eventName),
    !deepEqual(observed.interval, news.interval),
    !deepEqual(observed.limit, news.limit),
    !deepEqual(observed.selector, news.selector),
    !deepEqual(observed.intervalSeconds, news.intervalSeconds),
    !deepEqual(observed.maxTimerLengthSeconds, news.maxTimerLengthSeconds),
    !deepEqual(observed.verticalScrollPercentageList, news.verticalScrollPercentageList),
    !deepEqual(observed.horizontalScrollPercentageList, news.horizontalScrollPercentageList),
    !deepEqual(observed.visibilitySelector, news.visibilitySelector),
    !deepEqual(observed.visiblePercentageMin, news.visiblePercentageMin),
    !deepEqual(observed.visiblePercentageMax, news.visiblePercentageMax),
    !deepEqual(observed.continuousTimeMinMilliseconds, news.continuousTimeMinMilliseconds),
    !deepEqual(observed.totalTimeMinMilliseconds, news.totalTimeMinMilliseconds),
    observed.notes !== desiredNotes,
  ].some(Boolean);

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

            const oldComparable = buildTriggerOldComparable(output, o);
            const newComparable = buildTriggerNewComparable(news);
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
          const needsUpdate = isTriggerNeedsUpdate(
            observed,
            news,
            observedNotesStripped,
            desiredNotes,
          );

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
