import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import GitHost from "./src/index.ts";

export default Stack(
  "wwwtom-git",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* GitHost;

    return {
      url: worker.url,
    };
  }),
);
