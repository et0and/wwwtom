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
import type { Folder as FolderSchema, FolderDraft } from "./schemas.ts";

export type FolderProps = {
  readonly workspacePath: string;
  readonly name: string;
  readonly notes?: string;
};

export type FolderAttributes = {
  readonly accountId: string;
  readonly containerId: string;
  readonly workspaceId: string;
  readonly folderId: string;
  readonly path: string;
  readonly name: string;
  readonly notes: string;
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
};

export interface Folder extends Resource<"Gtm.Folder", FolderProps, FolderAttributes> {}

export const Folder = Resource<Folder>("Gtm.Folder");

const parentOf = (path: string): string => path.split("/folders/")[0] ?? "";

const toAttrs = (f: FolderSchema, notesWithoutMarker: string): FolderAttributes =>
  ({
    ...f,
    notes: notesWithoutMarker,
    fingerprint: f.fingerprint ?? "",
    tagManagerUrl: f.tagManagerUrl ?? "",
  }) as FolderAttributes;

export const FolderProvider = () =>
  Provider.effect(
    Folder as ResourceClassLike<Folder>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;
      const stack = yield* Stack;
      const stage = yield* Stage;

      const findByName = (workspacePath: string, name: string) =>
        Effect.gen(function* () {
          const res = yield* http.listFolders(workspacePath);
          const list = res.folder ?? [];
          return list.find((x) => x.name === name);
        });

      return {
        list: () => Effect.succeed([] as FolderAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<FolderProps> = olds ?? {};

            const oldParent = output ? parentOf(output.path) : o.workspacePath;
            if (oldParent !== undefined && news.workspacePath !== oldParent) {
              return { action: "replace" } as const;
            }

            const oldComparable = {
              notes: output ? stripMarker(output.notes) : (o.notes ?? ""),
              name: output?.name ?? o.name,
            };
            const newComparable = {
              notes: news.notes ?? "",
              name: news.name,
            };
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ id, olds, output }) {
          const o: Partial<FolderProps> = olds ?? {};
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
          const draft: FolderDraft = { ...rest, notes: desiredNotes };

          const observed = yield* findByName(workspacePath, news.name).pipe(
            Effect.catchTag("NotFound", () => Effect.void),
          );

          if (!observed) {
            const created = yield* http.createFolder(workspacePath, draft);
            return toAttrs(created, stripMarker(created.notes));
          }

          const observedNotesStripped = stripMarker(observed.notes);
          const needsUpdate =
            observed.name !== news.name ||
            observedNotesStripped !== stripMarker(news.notes ?? "") ||
            observed.notes !== desiredNotes;

          if (!needsUpdate) {
            return toAttrs(observed, observedNotesStripped);
          }

          const updateBody: FolderDraft = { ...draft, fingerprint: observed.fingerprint };
          const updated = yield* http.updateFolder(observed.path, updateBody);
          return toAttrs(updated, stripMarker(updated.notes));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteFolder(output.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Folder>;
    }),
  );
