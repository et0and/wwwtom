import { run, step, workflow } from "../builders";
import { actionPins } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * Mirror dev to SourceHut. `ubuntu-slim` is enough: the job only runs git and
 * ssh, and the full history comes from the checkout's fetch-depth.
 */
export const srht = workflow("srht", {
  name: "Mirror to SourceHut",
  on: { push: { branches: ["dev"] } },
  jobs: {
    mirror: {
      "runs-on": "ubuntu-slim",
      steps: [
        step({ uses: actionPins.checkout, with: { "fetch-depth": 0 } }),
        step({
          name: "Setup SSH",
          env: { SSH_PRIVATE_KEY: secret("SOURCEHUT_SSH_KEY") },
          run: [
            "mkdir -p ~/.ssh",
            `echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa`,
            "chmod 600 ~/.ssh/id_rsa",
            // ssh-keyscan can flake on git.sr.ht egress; retry once before
            // giving up (the step still fails if both attempts fail).
            "ssh-keyscan git.sr.ht >> ~/.ssh/known_hosts || { sleep 5; ssh-keyscan git.sr.ht >> ~/.ssh/known_hosts; }",
          ],
        }),
        run("Mirror to SourceHut", [
          "git remote add sourcehut git@git.sr.ht:~tomupom/wwwtom",
          "git push sourcehut dev --force",
          "git push sourcehut --all --force",
          "git push sourcehut --tags --force",
        ]),
      ],
    },
  },
});
