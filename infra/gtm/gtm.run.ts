import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { providers as gtmProviders } from "./index.ts";

export default Stack(
  "wwwtom-gtm",
  {
    providers: gtmProviders(),
    state: Cloudflare.state(),
  },
  // Foundation slice: no resources declared yet.
  // Production adopts the existing tom.so account/container/workspace;
  // other stages create per-stage containers/workspaces (handled in a later
  // slice where the stack declares those resources).
  Effect.succeed({}),
);
