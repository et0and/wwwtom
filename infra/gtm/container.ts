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
import type { Container as ContainerSchema, ContainerFeatures } from "./schemas.ts";

export type ContainerProps = {
  accountPath: string;
  name: string;
  usageContext?: string[];
  domainName?: string[];
  notes?: string;
};

export type ContainerAttributes = {
  accountId: string;
  containerId: string;
  path: string;
  publicId: string;
  name: string;
  usageContext?: string[];
  domainName?: string[];
  notes: string;
  fingerprint: string;
  tagManagerUrl: string;
  tagIds?: string[];
  features?: ContainerFeatures;
  taggingServerUrls?: string[];
};

export interface Container extends Resource<"Gtm.Container", ContainerProps, ContainerAttributes> {}

export const Container = Resource<Container>("Gtm.Container");

const parentOf = (path: string): string => path.split("/containers/")[0] ?? "";

const toAttrs = (c: ContainerSchema, notesWithoutMarker: string): ContainerAttributes => {
  const attrs: ContainerAttributes = {
    accountId: c.accountId,
    containerId: c.containerId,
    path: c.path,
    publicId: c.publicId ?? "",
    name: c.name,
    notes: notesWithoutMarker,
    fingerprint: c.fingerprint ?? "",
    tagManagerUrl: c.tagManagerUrl ?? "",
  };
  if (c.usageContext !== undefined) attrs.usageContext = c.usageContext;
  if (c.domainName !== undefined) attrs.domainName = c.domainName;
  if (c.tagIds !== undefined) attrs.tagIds = c.tagIds;
  if (c.features !== undefined) attrs.features = c.features;
  if (c.taggingServerUrls !== undefined) attrs.taggingServerUrls = c.taggingServerUrls;
  return attrs;
};

const withOptionalProps = (
  body: Partial<ContainerSchema>,
  props: ContainerProps,
): Partial<ContainerSchema> => {
  if (props.usageContext !== undefined) body.usageContext = props.usageContext;
  if (props.domainName !== undefined) body.domainName = props.domainName;
  return body;
};

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

            if (output && news.name !== output.name) {
              return { action: "update" } as const;
            }

            const oldNotesStripped = output ? stripMarker(output.notes) : (o.notes ?? "");
            if (
              oldNotesStripped !== (news.notes ?? "") ||
              !deepEqual(o.usageContext ?? output?.usageContext, news.usageContext) ||
              !deepEqual(o.domainName ?? output?.domainName, news.domainName)
            ) {
              return { action: "update" } as const;
            }
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

          const observed = yield* findByName(news.accountPath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createContainer(
              news.accountPath,
              withOptionalProps({ name: news.name, notes: desiredNotes }, news),
            );
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

          const updateBody = withOptionalProps({ name: news.name, notes: desiredNotes }, news);
          if (observed.fingerprint !== undefined) updateBody.fingerprint = observed.fingerprint;
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
