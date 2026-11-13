import * as Cloudflare from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

/**
 * Tom CMS database, one per stage.
 *
 * Tom CMS is retired and Tom R2 is dead: the only Tom database left is the
 * Better Auth session store the frame control page signs in through. Production
 * keeps the existing Payload-free name. Dev and staging keep Alchemy's
 * generated names so an existing area is never renamed. PR previews get a
 * deterministic per-stage name: they are created and migrated with the stage,
 * read no shared dev content, and are deleted by `destroy:api` when the PR
 * closes.
 */
const stageStorageName = (
  stage: string,
  previewPrefix: string,
  productionName: string,
): string | undefined =>
  stage === "production"
    ? productionName
    : stage.startsWith("pr-")
      ? `${previewPrefix}-${stage}`
      : undefined;

/**
 * The D1 name for a stage, or `undefined` to let Alchemy generate one.
 *
 * Production uses a fresh database: the Payload tables in tom-cms share names
 * with the CMS tables (posts, works, media, categories) but not shapes, so
 * they cannot coexist. tom-cms stays live for Payload until the cutover, then
 * retires. A PR preview gets a deterministic name of its own, so it never
 * touches the dev database.
 */
export const cmsD1Name = (stage: string): string | undefined =>
  stageStorageName(stage, "wwwtom-cms-d1", "tom-cms-v2");

export const cmsD1 = Effect.gen(function* () {
  const stage = yield* Stage;
  const name = cmsD1Name(stage);

  return yield* Cloudflare.D1.Database("wwwtom-cms-d1", {
    ...(name === undefined ? undefined : { name }),
    migrations: `${import.meta.dirname}/migrations`,
  });
});
