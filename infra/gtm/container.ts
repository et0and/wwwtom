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
import type { Container as ContainerSchema, ContainerDraft } from "./schemas.ts";

export type ContainerProps = {
  readonly accountPath: string;
  readonly name: string;
  readonly usageContext?: readonly string[];
  readonly domainName?: readonly string[];
  readonly notes?: string;
};

export type ContainerAttributes = {
  readonly accountId: string;
  readonly containerId: string;
  readonly path: string;
  readonly publicId: string;
  readonly name: string;
  readonly usageContext?: readonly string[];
  readonly domainName?: readonly string[];
  readonly notes: string;
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
  readonly tagIds?: readonly string[];
  readonly features?: ContainerSchema["features"];
  readonly taggingServerUrls?: readonly string[];
};

export interface Container extends Resource<"Gtm.Container", ContainerProps, ContainerAttributes> {}

export const Container = Resource<Container>("Gtm.Container");

const parentOf = (path: string): string => path.split("/containers/")[0] ?? "";

const toAttrs = (c: ContainerSchema, notesWithoutMarker: string): ContainerAttributes =>
  ({
    ...c,
    notes: notesWithoutMarker,
    publicId: c.publicId ?? "",
    fingerprint: c.fingerprint ?? "",
    tagManagerUrl: c.tagManagerUrl ?? "",
  }) as ContainerAttributes;

export const ContainerProvider = () =>
  Provider.effect(
    Container as ResourceClassLike<Container>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (accountPath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listContainers(accountPath);
          const list = res.container ?? [];
          return list.find((c) => c.name === name);
        });

      return {
        list: () => Effect.succeed([] as ContainerAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<ContainerProps> = olds ?? {};

            const oldParent = output ? parentOf(output.path) : o.accountPath;
            if (oldParent !== undefined && news.accountPath !== oldParent) {
              return { action: "replace" } as const;
            }

            const oldComparable = {
              name: output?.name ?? o.name,
              notes: output ? stripMarker(output.notes) : (o.notes ?? ""),
              usageContext: o.usageContext ?? output?.usageContext,
              domainName: o.domainName ?? output?.domainName,
            };
            const newComparable = {
              name: news.name,
              notes: news.notes ?? "",
              usageContext: news.usageContext,
              domainName: news.domainName,
            };
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<ContainerProps> = olds ?? {};
          const accountPath = output ? parentOf(output.path) : o.accountPath;
          const name = output?.name ?? o.name;
          if (!accountPath || !name) return undefined;

          const existing = yield* findByName(accountPath, name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );
          if (!existing) return undefined;

          const attrs = toAttrs(existing, stripMarker(existing.notes));
          return isOwnedMarker(existing.notes, stack.name, stage, id) ? attrs : Unowned(attrs);
        }),

        reconcile: Effect.fn(function* ({ id, news }) {
          const desiredNotes = augmentNotes(news.notes, buildMarker(stack.name, stage, id));
          const { accountPath, ...rest } = news;
          const draft: ContainerDraft = { ...rest, notes: desiredNotes, name: news.name };

          const observed = yield* findByName(accountPath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createContainer(accountPath, draft);
            return toAttrs(created, stripMarker(created.notes));
          }

          const observedNotesStripped = stripMarker(observed.notes);
          const needsUpdate =
            observed.name !== news.name ||
            observedNotesStripped !== stripMarker(news.notes ?? "") ||
            !deepEqual(observed.usageContext, news.usageContext) ||
            !deepEqual(observed.domainName, news.domainName) ||
            observed.notes !== desiredNotes;

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody: ContainerDraft = { ...draft, fingerprint: observed.fingerprint };
          const updated = yield* http.updateContainer(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteContainer(output.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Container>;
    }),
  );
