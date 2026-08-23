import * as Effect from "effect/Effect";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { GtmHttp } from "./http.ts";
import { augmentNotes, buildMarker, isOwnedMarker, stripMarker } from "./ownership.ts";
import type { Workspace as WorkspaceSchema } from "./schemas.ts";

export type WorkspaceProps = {
  containerPath: string;
  name: string;
  description?: string;
};

export type WorkspaceAttributes = {
  accountId: string;
  containerId: string;
  workspaceId: string;
  path: string;
  name: string;
  description: string;
  fingerprint: string;
  tagManagerUrl: string;
};

export interface Workspace extends Resource<"Gtm.Workspace", WorkspaceProps, WorkspaceAttributes> {}

export const Workspace = Resource<Workspace>("Gtm.Workspace");

const parentOf = (path: string): string => path.split("/workspaces/")[0] ?? "";

const toAttrs = (w: WorkspaceSchema, descWithoutMarker: string): WorkspaceAttributes => ({
  accountId: w.accountId,
  containerId: w.containerId,
  workspaceId: w.workspaceId,
  path: w.path,
  name: w.name,
  description: descWithoutMarker,
  fingerprint: w.fingerprint ?? "",
  tagManagerUrl: w.tagManagerUrl ?? "",
});

export const WorkspaceProvider = () =>
  Provider.effect(
    Workspace as ResourceClassLike<Workspace>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (containerPath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listWorkspaces(containerPath);
          const list = res.workspace ?? [];
          return list.find((w) => w.name === name);
        });

      return {
        list: () => Effect.succeed([] as WorkspaceAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<WorkspaceProps> = olds ?? {};

            const oldParent = output ? parentOf(output.path) : o.containerPath;
            if (oldParent !== undefined && news.containerPath !== oldParent) {
              return { action: "replace" } as const;
            }

            if (output && news.name !== output.name) {
              return { action: "update" } as const;
            }

            const oldDesc = output ? stripMarker(output.description) : (o.description ?? "");
            if (oldDesc !== (news.description ?? "")) {
              return { action: "update" } as const;
            }
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<WorkspaceProps> = olds ?? {};
          const containerPath = output ? parentOf(output.path) : o.containerPath;
          const name = output?.name ?? o.name;
          if (!containerPath || !name) return undefined;

          const existing = yield* findByName(containerPath, name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );
          if (!existing) return undefined;

          const attrs = toAttrs(existing, stripMarker(existing.description));
          return isOwnedMarker(existing.description, stack.name, stage, id)
            ? attrs
            : Unowned(attrs);
        }),

        reconcile: Effect.fn(function* ({ id, news }) {
          const desiredDescription = augmentNotes(
            news.description,
            buildMarker(stack.name, stage, id),
          );

          const observed = yield* findByName(news.containerPath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createWorkspace(news.containerPath, {
              name: news.name,
              description: desiredDescription,
            });
            return toAttrs(created, stripMarker(created.description));
          }

          const observedDescStripped = stripMarker(observed.description);
          const needsUpdate =
            observed.name !== news.name ||
            observedDescStripped !== stripMarker(news.description ?? "") ||
            observed.description !== desiredDescription;

          if (!needsUpdate) {
            return toAttrs(observed, observedDescStripped);
          }

          const updateBody: Partial<WorkspaceSchema> = {
            name: news.name,
            description: desiredDescription,
          };
          if (observed.fingerprint !== undefined) updateBody.fingerprint = observed.fingerprint;
          const updated = yield* http.updateWorkspace(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.description));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteWorkspace(output.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Workspace>;
    }),
  );
