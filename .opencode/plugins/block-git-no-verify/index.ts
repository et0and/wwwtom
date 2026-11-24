import { Plugin } from "@opencode/plugin";

import { applyCommandPolicy } from "../../../scripts/vcs-command-policy.mjs";

export default Plugin.define({
  id: "wwwtom.block-git-no-verify",
  async setup(ctx) {
    const registration = await ctx.shell.hook("create.before", (event) => {
      const result = applyCommandPolicy(event.command);

      if (result.action === "block") {
        throw new Error(result.reason);
      }

      event.command = result.command;
    });

    return () => registration.dispose();
  },
});
