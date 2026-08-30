# @tom/e2e — Playwright suites for tom.so

Two suites live here:

- **Fixture suite** (`tests/`, `playwright.config.ts`): every page on tom.so
  against a fully local stack whose services serve **fixture stores** instead
  of real upstreams (Polar, Are.na, Payload CMS, D1, the internal API). Runs
  on every PR against `dev` (merge requirement) and nightly. Tests assert
  user-visible behaviour only — never wire formats, request shapes or
  headers — so they stay service-agnostic and break only when the site
  actually changes.
- **Staging suite** (`tests-staging/`,
  `playwright.staging.config.ts`): content-agnostic smoke + real-data checks
  against the deployed `staging` Alchemy stage (`staging-web.tom.so`) — no
  fixture simulator, no `x-use-simulator` header. Runs nightly.

```
browser (Playwright, sends `x-use-simulator: 1`)
   │
   ▼
web (vite dev, :3000) ── SSR forward ─┐   browser calls (guestbook) carry the header directly
   │                                       ▼
   ▼                                  adapter (:8788) ── "am I in simulator mode?"
adapter proxies upstreams            │
   │  payload  → http://127.0.0.1:8789/api/*     (PayloadService URL swap)
   │  arena    → http://127.0.0.1:8789/v3/*      (ArenaService URL swap)
   │  polar    → http://127.0.0.1:8789/v1/*      (polarBaseUrl URL swap)
   │  api      → http://127.0.0.1:8789/*         (callApi URL swap: /checkout, /portal)
   │  guestbook→ http://127.0.0.1:8789/guestbook/entries (D1 bypass branch)
   ▼
simulator (:8789) — Elysia, fixture stores only
```

## How the routing works

`apps/adapter/src/simulator.ts` is the single seam:

- A request carrying `x-use-simulator` (non-empty) switches **only when** the
  worker also has a `SIMULATOR_URL` env var. Production never sets
  `SIMULATOR_URL`, so the header alone cannot redirect real traffic — the
  switch is opt-in per environment, not per visitor.
- `simulatorEnv(resolved, request)` rewrites `ARENA_API_URL`, `POLAR_API_URL`,
  `PAYLOAD_URL` and `API_URL` to the simulator base. The guestbook entries
  route has a small branch that fetches the simulator instead of D1 (the
  simulator mirrors `DatabaseService.getGuestbookEntries`'s
  `{ results, page, page_size, total_count }` shape).
- The web app forwards the header on server-side adapter calls
  (`apps/web/src/libs/adapter.ts` `callAdapter()` reads the incoming request's
  header in SSR); browser-side calls already carry it from the Playwright
  context. Adapter CORS allows the header for the browser calls.

Because the swap happens at the adapter's _service-boundary env_, no
integration code knows about the simulator — payload/arena/polar still speak
their normal client contract, just against the fixture host.

## Fixture stores (single source of truth)

`apps/simulator/fixtures/*.json` are the fixture stores. They are consumed by
**both** the simulator at runtime **and** the e2e assertions
(`apps/e2e/src/fixture-stores.ts`) — a test asserting on fixture data is
asserting on exactly what the page rendered, which keeps assertions honest and
diffs small when copy changes.

| Store                    | Serves                                   | Drives                                            |
| ------------------------ | ---------------------------------------- | ------------------------------------------------- |
| `polar-products.json`    | `/v1/*` (products, customers, checkouts) | `/products`, `/purchase`                          |
| `arena.json`             | `/v3/*` (channels, blocks, users)        | `/worktable` (channel `tom-s-worktable`)          |
| `payload-posts.json`     | `/api/posts` (Payload REST shape)        | `/posts`, pagination, `/feed.xml`, `/sitemap.xml` |
| `payload-works.json`     | `/api/works`                             | `/work`                                           |
| `guestbook-entries.json` | `/guestbook/entries`                     | `/guestbook`                                      |

Runtime-mutated in-memory stores live in the simulator plugins
(`customers` in `polar.ts`, `entries` in `guestbook.ts`) so write flows (e.g.
a future sign-in) behave like a real database within a run.

To add a fixture store: drop the JSON in `apps/simulator/fixtures/`, add an
Elysia plugin that serves the real service's wire shape (follow `polar.ts` /
`arena.ts`), mount it in `apps/simulator/src/index.ts`, then type the new
fixture in `apps/e2e/src/fixture-stores.ts` and write specs against it.

## Fixture stores vs Effect Layers (for testing)

They answer different questions:

- **Effect Layers** (`createPayloadLayer`, `createArenaLayer`, `createDbLayer`
  in `apps/adapter/src/config/effect.ts`, per <https://www.effect.solutions/testing>)
  replace a service **inside the process** — the right tool for adapter unit /
  integration tests that never touch the network. The adapter's integration
  tests can back their layers with the _same_ fixture JSON, making the stores
  the shared contract.
- **Playwright e2e** cannot use layers: the browser, SSR server and worker hop
  over real HTTP, and Effect layers cannot intercept the browser's network. The
  fixture-store simulator is the layer equivalent _at the network boundary_ —
  it makes the out-of-process services deterministic so the browser tests are
  as reproducible as layer tests.

Rule of thumb: layer tests prove the adapter's logic; the nightly suite proves
the whole stack renders the fixture data. Both should read the same fixture
files — never duplicate copies in test folders.

## Running locally

Prerequisites: `pnpm install` and Playwright browsers
(`npx playwright install chromium`). The web server is `vite dev`, which
compiles on demand — no production build needed.

```bash
pnpm --filter @tom/e2e test:e2e
```

For a headed run while services are already up (`pnpm dev:web` etc. in other
terminals), pass `-- --headed` or set `reuseExistingServer` in
`playwright.config.ts` (already the local default).

### Why `vite dev` and not `vite preview`?

The preview server's node middleware flattens `_server` (server-function RPC)
response headers, so every client-side server-function call — pagination
"Next", the purchase submit, the worktable carousel query — resolves to
`undefined` (`["posts",2] data is undefined`). Reproduced on both
`@solidjs/start@2.0.0-beta.9` and `2.0.0`. `vite dev` and the deployed Worker
both serve correct RPC responses (verified against live tom.so), so the suite
runs under dev. If you bump SolidStart, re-check the pagination test.

Dev also keeps Solid Meta's head injection faithful (the production build
served under plain Node produces an empty `<head>`, breaking titles/meta and
client hydration). A custom-node harness is deliberately not used.

The suite runs **fully parallel** (`fullyParallel: true`, default workers):
Solid 2 scopes each SSR request with `node:async_hooks`
(`provideRequestEvent`), so parallel renders no longer share a racy
`sharedConfig`, and the web app gives each request its own query cache
(`locals.queryClient`) — parallel pages never share TanStack state.

CI sets `CI=true` so `webServer` entries **fail fast** if a port isn't up, and
retries once on failure.

## The fixture-suite GitHub workflow

`.github/workflows/e2e.yml` runs on pushes to PRs against `dev` (concurrent
runs are cancelled per PR number so only the latest passes), on a cron
(02:17 UTC) and on `workflow_dispatch`. There is deliberately no `push`
trigger — a merged dev commit already ran green as the last PR state. It:

1. checks out and installs;
2. starts simulator → adapter harness → `vite dev` (Playwright
   `webServer`);
3. runs the suite with `npx playwright install --with-deps chromium`;
4. uploads `playwright-report/` + `test-results/` (traces) as artifacts on
   failure.

`pnpm test` / `pnpm typecheck` (turbo) deliberately **do not** include this
suite — it's PR + nightly only. Use `pnpm --filter @tom/e2e typecheck`
locally.

## The staging suite

`tests-staging/` runs against the **deployed staging stack** (real CMS, Polar,
Are.na — whatever the `staging` Alchemy stage holds), so assertions are
content-agnostic: structure, headings, valid feeds/sitemap, 404s, og
meta, and read-only navigation into the first live post/work/product. The
guestbook and checkout flows are rendered but never submitted (they mutate
real data). Run it locally against any deployed stage:

```sh
pnpm --filter @tom/e2e test:e2e:staging
E2E_STAGING_URL=https://pr-114-web.tom.so \
E2E_STAGING_ADAPTER_URL=https://pr-114-adapter.tom.so \
pnpm --filter @tom/e2e test:e2e:staging
```

The workflow `.github/workflows/e2e-staging.yml` runs it nightly (02:47 UTC)
and on `workflow_dispatch`. Every push to `dev` deploys the staging stage
via the Deploy workflow (production deploys are manual), so the nightly
validates the latest staged stack.

## Conventions for tests in this suite

- Assert fixture data (titles, prices, messages) — never request counts,
  headers, or the adapter/simulator wire format.
- Prefer role-based locators (`getByRole`, `getByText`, `getByAltText`);
  structural selectors only for fixture-specific containers (`guestbook-entry`).
- No `waitForTimeout`; rely on `expect` auto-waiting. Blur-in heading animations
  are disabled via `helpers.disableAnimations` (they start invisible); the
  sr-only accessible text they hide is preserved, so `getByRole("heading")`
  still resolves.
- Single browser project; **fully parallel** (`fullyParallel: true`, default
  workers). Solid 2 scopes SSR requests with `node:async_hooks`, and the web
  app owns a query cache per request, so concurrent renders don't race.
- Expected-failure deltas for a11y (serious/critical only) are triaged via the
  HTML report, not silently skipped.

## Known gaps / next steps

- **Guestbook sign-in** — Fediverse OAuth is an external integration; the
  suite asserts the read path + sign-in affordances. Simulating auth would
  need the adapter's auth branch to also talk to the simulator.
- **Github / image / og integrations** — untouched by this first pass (no
  page drives them; the OG renderer is exercised by `/api/og` only).
- **Multiple environments** — the same suite could run against a deployed
  staging stack by injecting the header through a proxy; keep `SIMULATOR_URL`
  unset so the header stays inert by default.
