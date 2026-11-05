import { run, step, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * semantic-release owns versioning and the changelog on every push to dev.
 * The checkout keeps full history and credentials: the release step pushes
 * tags and commits back.
 */
export const release = workflow("release", {
  name: "Release",
  on: { push: { branches: ["dev"] } },
  permissions: {
    contents: "write",
    issues: "write",
    "pull-requests": "write",
    "id-token": "write",
  },
  jobs: {
    release: {
      name: "Release",
      "runs-on": "ubuntu-latest",
      steps: [
        checkout("Checkout", { "fetch-depth": 0, "persist-credentials": true }),
        setupStep(),
        run("Fetch all tags and ensure branch is up to date", [
          "git fetch --tags",
          "git checkout dev",
          "git pull origin dev",
        ]),
        run("Build", "pnpm run build"),
        step({
          name: "Release",
          run: "pnpm run semantic-release",
          env: { GITHUB_TOKEN: secret("GITHUB_TOKEN") },
        }),
      ],
    },
  },
});
