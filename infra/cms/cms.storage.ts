import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { retain } from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";

export const cmsD1 = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.D1.Database("wwwtom-cms-d1", {
    // Production uses a fresh database: the Payload tables in tom-cms share
    // names with the CMS tables (posts, works, media, categories) but not
    // shapes, so they cannot coexist. tom-cms stays live for Payload until
    // the cutover, then retires. Other stages get isolated databases.
    ...(stage === "production" ? { name: "tom-cms-v2" } : undefined),
    migrationsDir: `${import.meta.dirname}/migrations`,
  });
});

export const cmsMediaBucket = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.R2.Bucket("wwwtom-cms-media", {
    ...(stage === "production" ? { name: "tom-cms-media" } : undefined),
  });
});

// PR previews read the dev database + bucket directly so posts/works
// render real content. No migrations run here (dev is already migrated).
// Retained unconditionally: destroying a preview stage releases these
// handles without ever deleting dev resources. Preview writes are
// impractical (GitHub OAuth cannot issue sessions on preview origins),
// so sharing dev content is safe.
const DEV_D1_NAME = "wwwtom-api-wwwtom-cms-d1-dev-t76vc7wvmdnzyrif";
const DEV_MEDIA_NAME = "wwwtom-api-wwwtom-cms-media-dev-nurxs6it4jn5wiwr";

export const previewCmsD1 = Cloudflare.D1.Database("wwwtom-preview-cms-d1", {
  name: DEV_D1_NAME,
}).pipe(retain());

export const previewCmsMedia = Cloudflare.R2.Bucket("wwwtom-preview-cms-media", {
  name: DEV_MEDIA_NAME,
}).pipe(retain());
