import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { HttpError } from "./errors.ts";
import { GtmHttp } from "./http.ts";
import type { ContainerVersion, GetWorkspaceStatusResponse } from "./schemas.ts";

export type VersionProps = {
  readonly workspacePath: string;
  readonly name?: string;
  readonly notes?: string;
  readonly publish?: boolean;
};

export type VersionAttributes = {
  readonly path: string;
  readonly containerVersionId: string;
  readonly accountId: string;
  readonly containerId: string;
  readonly name: string;
  readonly description: string;
  readonly fingerprint: string;
  readonly tagManagerUrl: string;
};

export interface Version extends Resource<"Gtm.Version", VersionProps, VersionAttributes> {}

export const Version = Resource<Version>("Gtm.Version");

const containerOf = (workspacePath: string): string => workspacePath.split("/workspaces/")[0] ?? "";

const toAttrs = (v: ContainerVersion): VersionAttributes =>
  ({
    path: v.path,
    containerVersionId: v.containerVersionId,
    accountId: v.accountId,
    containerId: v.containerId,
    name: v.name ?? "",
    description: v.description ?? "",
    fingerprint: v.fingerprint ?? "",
    tagManagerUrl: v.tagManagerUrl ?? "",
  }) as VersionAttributes;

export const VersionProvider = () =>
  Provider.effect(
    Version as ResourceClassLike<Version>,
    Effect.gen(function* () {
      const http = yield* GtmHttp;

      return {
        list: () => Effect.succeed([] as VersionAttributes[]),

        diff: ({ olds, news, output }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const o: Partial<VersionProps> = olds ?? {};

            if (output) {
              const outContainer = output.path.split("/versions/")[0] ?? "";
              if (containerOf(news.workspacePath) !== outContainer) {
                return { action: "replace" } as const;
              }
            } else if (o.workspacePath !== undefined && news.workspacePath !== o.workspacePath) {
              return { action: "replace" } as const;
            }

            const oldComparable = {
              name: output?.name ?? o.name,
              notes: output?.description ?? o.notes,
              publish: o.publish,
            };
            const newComparable = {
              name: news.name,
              notes: news.notes,
              publish: news.publish,
            };
            if (!deepEqual(oldComparable, newComparable)) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ olds, output }) {
          const o: Partial<VersionProps> = olds ?? {};
          const containerPath = output
            ? (output.path.split("/versions/")[0] ?? "")
            : o.workspacePath
              ? containerOf(o.workspacePath)
              : "";
          if (!containerPath) return undefined;
          const header = yield* http
            .getLatestContainerVersionHeader(containerPath)
            .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined as never)));
          if (!header) return undefined;
          const version = yield* http
            .getContainerVersion(header.path)
            .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined as never)));
          if (!version) return undefined;
          return toAttrs(version);
        }),

        reconcile: Effect.fn(function* ({ news }) {
          const containerPath = containerOf(news.workspacePath);

          const status = yield* http
            .getWorkspaceStatus(news.workspacePath)
            .pipe(
              Effect.catchTag("NotFound", () =>
                Effect.succeed({ workspaceChange: [] } as GetWorkspaceStatusResponse),
              ),
            );
          const hasChanges = (status.workspaceChange?.length ?? 0) > 0;

          // If no changes, return latest version if exists without creating
          if (!hasChanges) {
            const latest = yield* http
              .getLatestContainerVersionHeader(containerPath)
              .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined as never)));
            if (latest) {
              const existing = yield* http
                .getContainerVersion(latest.path)
                .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined as never)));
              if (existing) {
                const attrs = toAttrs(existing);
                if (news.publish) {
                  const live = yield* http
                    .getLiveContainerVersion(containerPath)
                    .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined as never)));
                  if (!live || live.path !== attrs.path) {
                    yield* http.publishContainerVersion(attrs.path).pipe(
                      Effect.catchTag("NotFound", () => Effect.void),
                      Effect.catchTag("Conflict", () => Effect.void),
                    );
                  }
                }
                return attrs;
              }
            }
            // No existing version and no changes - still create initial version to satisfy resource existence
          }

          const created = yield* http.createContainerVersion(news.workspacePath, {
            name: news.name,
            notes: news.notes,
          });
          const version = created.containerVersion;
          if (!version) {
            return yield* new HttpError({
              message: "create_version returned no containerVersion",
              status: 500,
              body: "",
            });
          }
          const attrs = toAttrs(version);

          if (news.publish) {
            yield* http.publishContainerVersion(attrs.path).pipe(
              Effect.catchTag("NotFound", () => Effect.void),
              Effect.catchTag("Conflict", () => Effect.void),
            );
          }

          return attrs;
        }),

        delete: Effect.fn(function* () {
          // Container versions are append-only; delete is no-op
        }),
      } satisfies Provider.ProviderServiceInput<Version>;
    }),
  );
