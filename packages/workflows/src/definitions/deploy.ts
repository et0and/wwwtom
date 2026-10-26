import { run, step, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import {
  alchemyEnv,
  deployChain,
  deployStacks,
  edgeStacks,
  stageConcurrencyGroup,
  stageExpression,
  stageLabel,
} from "../catalog/alchemy";
import { loadSecrets } from "../catalog/onepassword";

/**
 * Pushes to dev deploy the staging stage. Production is a manual
 * workflow_dispatch with its own environment approval gate, so the `stage`
 * input drives the environment, stage, and concurrency group of the run.
 */
export const deploy = workflow("deploy", {
  name: "Deploy",
  on: {
    workflow_dispatch: {
      inputs: {
        stage: {
          description: "Alchemy stage to deploy",
          required: true,
          type: "choice",
          options: ["production", "staging", "dev"],
        },
      },
    },
    push: { branches: ["dev"] },
  },
  permissions: { contents: "read" },
  concurrency: { group: stageConcurrencyGroup, "cancel-in-progress": true },
  jobs: {
    deploy: {
      name: stageLabel,
      "runs-on": "namespace-profile-yufugumi",
      environment: stageExpression,
      env: alchemyEnv(stageExpression),
      steps: [
        // Full history so `git describe --tags` can stamp the release version
        // into the web build.
        checkout("Checkout", { "fetch-depth": 0 }),
        loadSecrets(stageExpression),
        setupStep(),
        run("Deploy infrastructure", deployChain(deployStacks)),
        // Zone-level rules are shared by every stage, so exactly one stage may
        // own them. Production only: a staging run would rewrite the same
        // rulesets from a second Alchemy state and the two would drift.
        step({
          name: "Deploy zone edge rules",
          if: "github.event_name == 'workflow_dispatch' && inputs.stage == 'production'",
          run: deployChain(edgeStacks),
        }),
      ],
    },
  },
});
