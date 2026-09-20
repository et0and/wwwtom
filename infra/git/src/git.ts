import * as Cloudflare from "alchemy/Cloudflare";
import * as Git from "alchemy/Git";
import { Effect, Layer } from "effect";
import { Stage } from "alchemy/Stage";
import { Authentication } from "./middleware.ts";

/** Repos, packs, and clone bundles live in R2; dev stages are disposable. */
const GitObjects = Cloudflare.R2.Bucket("GitObjects", {
  forceDestroy: Effect.gen(function* () {
    const stage = yield* Stage;
    return stage !== "production";
  }),
});

const PublicRoutes = Git.ApiLive.pipe(Layer.provide(Authentication.layer));

export const GitLive = PublicRoutes.pipe(
  Layer.provide(Git.ApiHandlersLive),
  Layer.provide(Git.ReposDurableObject),
  Layer.provide(Git.RegistryDurableObject),
  Layer.provide(Git.HasherInline),
  Layer.provide(Git.BlobStoreR2(GitObjects)),
);
