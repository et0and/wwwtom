import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { sophieWebHost, stageWebHost } from "./shared.run.ts";
import { previewComment } from "./utils/github/preview-comment.ts";

/**
 * The PR preview comment, and nothing else. No Cloudflare resource lives
 * here.
 *
 * It runs last in the preview chain so every link it posts is live by the
 * time it posts, and it owns the single consolidated comment rather than
 * each app stack commenting for itself. Every preview host derives from the
 * stage name, so the URLs are known without reading a deployed resource.
 */
export default Stack(
  "wwwtom-preview",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;

    yield* previewComment({
      id: "wwwtom-preview",
      apps: [
        { name: "Web", url: `https://${stageWebHost(stage)}` },
        { name: "Sophie", url: `https://${sophieWebHost(stage)}` },
      ],
    });
  }),
);
