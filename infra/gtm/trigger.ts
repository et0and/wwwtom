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
  autoEventFilter?: Condition[];
  parentFolderId?: string;
  notes?: string;
  waitForTags?: Parameter;
  checkValidation?: Parameter;
  waitForTagsTimeout?: Parameter;
  uniqueTriggerId?: Parameter;
  eventName?: Parameter;
  interval?: Parameter;
  limit?: Parameter;
  selector?: Parameter;
  intervalSeconds?: Parameter;
  maxTimerLengthSeconds?: Parameter;
  verticalScrollPercentageList?: Parameter;
  horizontalScrollPercentageList?: Parameter;
  visibilitySelector?: Parameter;
  visiblePercentageMin?: Parameter;
  visiblePercentageMax?: Parameter;
  continuousTimeMinMilliseconds?: Parameter;
  totalTimeMinMilliseconds?: Parameter;
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
  autoEventFilter?: Condition[];
  parentFolderId?: string;
  notes: string;
  fingerprint: string;
  tagManagerUrl: string;
  waitForTags?: Parameter;
  checkValidation?: Parameter;
  waitForTagsTimeout?: Parameter;
  uniqueTriggerId?: Parameter;
  eventName?: Parameter;
  interval?: Parameter;
  limit?: Parameter;
  selector?: Parameter;
  intervalSeconds?: Parameter;
  maxTimerLengthSeconds?: Parameter;
  verticalScrollPercentageList?: Parameter;
  horizontalScrollPercentageList?: Parameter;
  visibilitySelector?: Parameter;
  visiblePercentageMin?: Parameter;
  visiblePercentageMax?: Parameter;
  continuousTimeMinMilliseconds?: Parameter;
  totalTimeMinMilliseconds?: Parameter;
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
  if (t.autoEventFilter !== undefined) attrs.autoEventFilter = t.autoEventFilter;
  if (t.parentFolderId !== undefined) attrs.parentFolderId = t.parentFolderId;
  if (t.waitForTags !== undefined) attrs.waitForTags = t.waitForTags;
  if (t.checkValidation !== undefined) attrs.checkValidation = t.checkValidation;
  if (t.waitForTagsTimeout !== undefined) attrs.waitForTagsTimeout = t.waitForTagsTimeout;
  if (t.uniqueTriggerId !== undefined) attrs.uniqueTriggerId = t.uniqueTriggerId;
  if (t.eventName !== undefined) attrs.eventName = t.eventName;
  if (t.interval !== undefined) attrs.interval = t.interval;
  if (t.limit !== undefined) attrs.limit = t.limit;
  if (t.selector !== undefined) attrs.selector = t.selector;
  if (t.intervalSeconds !== undefined) attrs.intervalSeconds = t.intervalSeconds;
  if (t.maxTimerLengthSeconds !== undefined) attrs.maxTimerLengthSeconds = t.maxTimerLengthSeconds;
  if (t.verticalScrollPercentageList !== undefined)
    attrs.verticalScrollPercentageList = t.verticalScrollPercentageList;
  if (t.horizontalScrollPercentageList !== undefined)
    attrs.horizontalScrollPercentageList = t.horizontalScrollPercentageList;
  if (t.visibilitySelector !== undefined) attrs.visibilitySelector = t.visibilitySelector;
  if (t.visiblePercentageMin !== undefined) attrs.visiblePercentageMin = t.visiblePercentageMin;
  if (t.visiblePercentageMax !== undefined) attrs.visiblePercentageMax = t.visiblePercentageMax;
  if (t.continuousTimeMinMilliseconds !== undefined)
    attrs.continuousTimeMinMilliseconds = t.continuousTimeMinMilliseconds;
  if (t.totalTimeMinMilliseconds !== undefined)
    attrs.totalTimeMinMilliseconds = t.totalTimeMinMilliseconds;
  return attrs;
};

const withOptionalProps = (
  body: Partial<TriggerSchema>,
  props: TriggerProps,
): Partial<TriggerSchema> => {
  if (props.parameter !== undefined) body.parameter = props.parameter;
  if (props.filter !== undefined) body.filter = props.filter;
  if (props.customEventFilter !== undefined) body.customEventFilter = props.customEventFilter;
  if (props.autoEventFilter !== undefined) body.autoEventFilter = props.autoEventFilter;
  if (props.parentFolderId !== undefined) body.parentFolderId = props.parentFolderId;
  if (props.waitForTags !== undefined) body.waitForTags = props.waitForTags;
  if (props.checkValidation !== undefined) body.checkValidation = props.checkValidation;
  if (props.waitForTagsTimeout !== undefined) body.waitForTagsTimeout = props.waitForTagsTimeout;
  if (props.uniqueTriggerId !== undefined) body.uniqueTriggerId = props.uniqueTriggerId;
  if (props.eventName !== undefined) body.eventName = props.eventName;
  if (props.interval !== undefined) body.interval = props.interval;
  if (props.limit !== undefined) body.limit = props.limit;
  if (props.selector !== undefined) body.selector = props.selector;
  if (props.intervalSeconds !== undefined) body.intervalSeconds = props.intervalSeconds;
  if (props.maxTimerLengthSeconds !== undefined)
    body.maxTimerLengthSeconds = props.maxTimerLengthSeconds;
  if (props.verticalScrollPercentageList !== undefined)
    body.verticalScrollPercentageList = props.verticalScrollPercentageList;
  if (props.horizontalScrollPercentageList !== undefined)
    body.horizontalScrollPercentageList = props.horizontalScrollPercentageList;
  if (props.visibilitySelector !== undefined) body.visibilitySelector = props.visibilitySelector;
  if (props.visiblePercentageMin !== undefined)
    body.visiblePercentageMin = props.visiblePercentageMin;
  if (props.visiblePercentageMax !== undefined)
    body.visiblePercentageMax = props.visiblePercentageMax;
  if (props.continuousTimeMinMilliseconds !== undefined)
    body.continuousTimeMinMilliseconds = props.continuousTimeMinMilliseconds;
  if (props.totalTimeMinMilliseconds !== undefined)
    body.totalTimeMinMilliseconds = props.totalTimeMinMilliseconds;
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
            if (!deepEqual(o.autoEventFilter ?? output?.autoEventFilter, news.autoEventFilter))
              return { action: "update" } as const;
            if ((o.parentFolderId ?? output?.parentFolderId) !== news.parentFolderId)
              return { action: "update" } as const;
            if (!deepEqual(o.waitForTags ?? output?.waitForTags, news.waitForTags))
              return { action: "update" } as const;
            if (!deepEqual(o.checkValidation ?? output?.checkValidation, news.checkValidation))
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.waitForTagsTimeout ?? output?.waitForTagsTimeout,
                news.waitForTagsTimeout,
              )
            )
              return { action: "update" } as const;
            if (!deepEqual(o.uniqueTriggerId ?? output?.uniqueTriggerId, news.uniqueTriggerId))
              return { action: "update" } as const;
            if (!deepEqual(o.eventName ?? output?.eventName, news.eventName))
              return { action: "update" } as const;
            if (!deepEqual(o.interval ?? output?.interval, news.interval))
              return { action: "update" } as const;
            if (!deepEqual(o.limit ?? output?.limit, news.limit))
              return { action: "update" } as const;
            if (!deepEqual(o.selector ?? output?.selector, news.selector))
              return { action: "update" } as const;
            if (!deepEqual(o.intervalSeconds ?? output?.intervalSeconds, news.intervalSeconds))
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.maxTimerLengthSeconds ?? output?.maxTimerLengthSeconds,
                news.maxTimerLengthSeconds,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.verticalScrollPercentageList ?? output?.verticalScrollPercentageList,
                news.verticalScrollPercentageList,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.horizontalScrollPercentageList ?? output?.horizontalScrollPercentageList,
                news.horizontalScrollPercentageList,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.visibilitySelector ?? output?.visibilitySelector,
                news.visibilitySelector,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.visiblePercentageMin ?? output?.visiblePercentageMin,
                news.visiblePercentageMin,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.visiblePercentageMax ?? output?.visiblePercentageMax,
                news.visiblePercentageMax,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.continuousTimeMinMilliseconds ?? output?.continuousTimeMinMilliseconds,
                news.continuousTimeMinMilliseconds,
              )
            )
              return { action: "update" } as const;
            if (
              !deepEqual(
                o.totalTimeMinMilliseconds ?? output?.totalTimeMinMilliseconds,
                news.totalTimeMinMilliseconds,
              )
            )
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
