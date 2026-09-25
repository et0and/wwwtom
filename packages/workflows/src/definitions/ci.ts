import { run, step, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";
import { turboEnv, turboTask } from "../catalog/turbo";

/**
 * CI is the hard merge gate for every push to dev and every PR against dev:
 * generated files must match their sources, and typecheck, lint and unit tests
 * must pass in every workspace before a PR can merge.
 */
export const ci = workflow("ci", {
  name: "CI",
  on: {
    push: { branches: ["dev"] },
    pull_request: { branches: ["dev"] },
  },
  jobs: {
    test: {
      name: "Test",
      "runs-on": "ubuntu-latest",
      // Turbo remote cache credentials shared by every Turbo task below.
      env: turboEnv(),
      steps: [
        checkout(),
        setupStep(),
        // Fail when @tom/types/db.ts drifts from the migrations. Generation
        // boots in-process PGlite; needs no network and no secrets.
        run("Check generated DB types are current", [
          "pnpm --filter @tom/db generate",
          "pnpm exec oxfmt --write packages/types/src/db.ts",
          "git diff --exit-code packages/types/src/db.ts",
        ]),
        // Fail when the committed GitHub Actions YAML drifts from the
        // @tom/workflows definitions, including new files that were never
        // committed.
        run("Check generated workflows are current", [
          "pnpm workflows",
          'if [ -n "$(git status --porcelain -- .github/workflows .github/actions)" ]; then',
          "  git status --short -- .github/workflows .github/actions",
          "  git diff -- .github/workflows .github/actions",
          "  exit 1",
          "fi",
        ]),
        // Typecheck is a hard merge gate: every workspace with a `typecheck`
        // script must pass before unit tests run.
        run("Run typecheck", turboTask("typecheck")),
        // oxlint carries the anti-slop rules (unknown parameters, broad
        // dictionaries, chained assertions, barrel files). Every workspace with
        // a `lint` script must pass, so those patterns cannot merge.
        run("Run lint", turboTask("lint")),
        // Build the client applications and enforce the checked-in bundle
        // budgets with the pinned OCaml checker container.
        run("Build and check bundle budgets", "pnpm check:bundles"),
        // Unit tests run in every workspace with a `test` script. Task
        // artifacts are shared through the KV-backed remote cache; the
        // signature key lets Turbo sign and verify every artifact so a leaked
        // write token cannot poison the cache.
        step({
          name: "Run unit tests",
          run: turboTask("test"),
          env: { ARENA_TOKEN: secret("ARENA_TOKEN") },
        }),
      ],
    },
  },
});
