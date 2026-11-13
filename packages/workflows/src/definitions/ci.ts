import { run, step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";
import { nodeHeapEnv } from "../catalog/node";
import { secret } from "../catalog/secrets";
import { turboEnv, turboTask } from "../catalog/turbo";

/** Pinned toolchain for the firmware job; both are cached by exact key. */
const PLATFORMIO_VERSION = "6.2.0";
const ESPRESSIF32_PLATFORM_VERSION = "8.0.0";

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
  env: nodeHeapEnv(),
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
    firmware: {
      name: "Firmware",
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 30,
      steps: [
        checkout(),
        // Exact key, no restore-keys: a stale core dir must never supply a
        // newer platform than the one this run pins.
        step({
          name: "Cache PlatformIO",
          uses: actionPins.cache,
          with: {
            path: "~/.platformio",
            key: `\${{ runner.os }}-platformio-${PLATFORMIO_VERSION}-${ESPRESSIF32_PLATFORM_VERSION}-\${{ hashFiles('firmware/frame/platformio.ini') }}`,
          },
        }),
        run("Install PlatformIO", [
          'python3 -m venv "$RUNNER_TEMP/platformio-venv"',
          '"$RUNNER_TEMP/platformio-venv/bin/pip" install --disable-pip-version-check platformio==' +
            PLATFORMIO_VERSION,
          'echo "$RUNNER_TEMP/platformio-venv/bin" >> "$GITHUB_PATH"',
        ]),
        // `platformio.ini` leaves the platform floating so a developer can
        // follow Arduino core releases. CI installs the pinned version into
        // the global core dir (`~/.platformio`, the cached path) and `pio run`
        // then resolves `platform = espressif32` to that installed version
        // instead of downloading the latest. Without `--global` the package
        // lands in the project's `.pio` store and dodges the cache entirely.
        run("Install the pinned ESP32 platform", [
          "cd firmware/frame",
          `pio pkg install --global --platform espressif32@${ESPRESSIF32_PLATFORM_VERSION}`,
        ]),
        // The sketch requires config.h, which is gitignored because it holds
        // a developer's network. CI writes a build-only placeholder instead:
        // no secrets, no network access, and the compile still exercises every
        // firmware translation unit.
        run("Write the CI firmware configuration", [
          "cd firmware/frame",
          "cat > include/config.h <<'EOF'",
          "// Generated in CI: placeholder values only.",
          '#define WIFI_SSID ""',
          '#define WIFI_PASSWORD ""',
          '#define ADAPTER_BASE_URL "https://adapter.invalid"',
          '#define CHANNEL_SLUG "ci"',
          '#define FRAME_DEVICE_TOKEN ""',
          "#define FRAME_ROTATION 1",
          "#define FRAME_CYCLE_SECONDS 600",
          '#define TIMEZONE "UTC0"',
          '#define WEATHER_LOCATION "London"',
          "EOF",
        ]),
        run("Compile the frame firmware", [
          "cd firmware/frame",
          "pio run --environment tdisplay",
        ]),
      ],
    },
  },
});
