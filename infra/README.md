# @tom/infra

Cloudflare infrastructure for `wwwtom`, managed with Alchemy V2 and
Effect V4.

## Managed apps

- `apps/web`: SolidStart 2, built by `Cloudflare.Website.Vite`
- `apps/sophie`: Sophie SSR blog, built by `Cloudflare.Website.Vite`
- `apps/editor`: Camus CMS SPA, built by `Cloudflare.Website.Vite` (Tom instance + Sophie instance via `VITE_SOPHIE`/`VITE_AUTH_PROVIDER`)
- `apps/api`: Elysia Worker (Tom + Sophie tenants via `TENANT`; isolated D1+R2 per tenant)
- `apps/adapter`: Elysia BFF Worker (integrations: arena, auth, cms, polar, guestbook, github, image, og; same tenant split)
- `turbo`: KV-backed Turborepo remote cache (`turbo.infra.tom.so`) for CI/CD
- `runner`: ephemeral GitHub Actions runners on Cloudflare Sandboxes (container-backed DO; source + image live in `infra/runner`)

The `production` stage adopts the existing resources instead of replacing
them:

- `wwwtom` on `tom.so`
- `apitom` on `api.tom.so`
- `TOM_RATE_LIMIT_KV`
- `guestbook-hyperdrive`

Other explicit stages create isolated resources automatically.

## Deploy

From the repository root:

```bash
# Existing production resources and domains
ALCHEMY_STAGE=production pnpm deploy

# Isolated non-production resources
ALCHEMY_STAGE=dev pnpm deploy
ALCHEMY_STAGE=staging pnpm deploy

# Deploy one component
pnpm deploy:shared
pnpm deploy:api
pnpm deploy:adapter
pnpm deploy:web
pnpm deploy:sophie
pnpm deploy:runner
pnpm deploy:turbo
```

Deployment order is `shared -> turbo -> api -> adapter -> web -> sophie`.

The `runner` stack is on-demand infrastructure, not part of the default
`deploy` chain. `POST /runners` starts one ephemeral GitHub Actions runner:

```sh
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer $CONTROL_TOKEN" \
  https://runner.tom.so/runners
```

Target it from a workflow with `runs-on: cloudflare-sandbox`. Each runner
registers with GitHub, accepts one job, then calls back to destroy its own
sandbox.

`pnpm destroy` tears down the current stage in reverse order
(`sophie -> editor -> web -> adapter -> api -> turbo -> shared`).

Local dev for the adapter (workerd + real bindings from `alchemy dev`):

```bash
pnpm dev:adapter
```

The adapter runs on `http://localhost:8788`; local secrets are split out of the
`TOM_SECRETS` bundle because Secrets Store bindings are not supported in local
mode.

## Turbo remote cache

The `turbo` stack implements the Turborepo remote-cache protocol
(`/v8/artifacts/{hash}` GET/HEAD/PUT, `/v8/artifacts/status`, and
`/v8/artifacts/events`) on a Cloudflare KV namespace, so CI runs share task
artifacts and skip work that another run already did.

- The production worker lives at `https://turbo.infra.tom.so`; other stages
  get `{stage}-turbo.infra.tom.so`.
- Artifacts are gzip-compressed tarballs capped at Cloudflare KV's 25 MiB value
  limit (oversized uploads fail with 413) and expire after 7 days.
- Every route requires `Authorization: Bearer <token>`. The token is read from
  the TOM_SECRETS bundle as `TURBO_CACHE_TOKEN` (min length 32) and must also
  be stored as a GitHub Actions repository secret `TURBO_CACHE_TOKEN`.
- When `TURBO_CACHE_SIGNATURE_KEY` is in the bundle, uploads must include an
  `x-artifact-tag` header (base64 HMAC-SHA256 over `hash || teamId || body`)
  and the worker rejects unsigned or tampered artifacts with 401. This is
  Turbo's own signing scheme, so a leaked write token cannot poison the cache.
  The repo's `turbo.json` declares `remoteCache.signature: true`, which is the
  client-side switch that makes Turbo sign; Turbo reads the key itself from
  the `TURBO_REMOTE_CACHE_SIGNATURE_KEY` environment variable. Runtimes
  without the key get non-fatal remote-cache warnings, so local dev is
  unaffected until a machine opts in.

Point Turbo 2.x at it from CI or a local shell:

```bash
export TURBO_API=https://turbo.infra.tom.so
# Same value as the TURBO_CACHE_TOKEN entry in the TOM_SECRETS bundle.
export TURBO_TOKEN=<token>
export TURBO_TEAM=wwwtom  # required or Turbo keeps remote caching disabled
# Same value as the TURBO_CACHE_SIGNATURE_KEY bundle entry (Turbo's client-
# side name for the signing key; min 32 bytes when the key is enabled).
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=<signature-key>
```

Local dev for the cache worker (workerd + real bindings from `alchemy dev`):

```bash
pnpm dev:turbo
```

The cache worker runs on `http://localhost:8790` by default. Deploy with
`pnpm deploy:turbo`.

`ALCHEMY_STAGE` is required. This prevents a command intended for production
from silently creating a new stage-specific Worker.

## Environment

Alchemy uses the Cloudflare credentials configured by `alchemy login`, or
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in CI. Set
`ALCHEMY_PASSWORD` to encrypt deployment state.

`infra/.dev.vars` is the default local deployment environment file. The
scripts preload it into `process.env`, which the stack uses to seed secrets.
Set `ALCHEMY_ENV_FILE` to use another dotenv file in CI or locally.
`TOM_SECRETS` is required for deploys. It must be a JSON object. The shared
Cloudflare Secrets Store exposes it to both Workers as `TOM_SECRETS`.

```json
{
  "ARENA_TOKEN": "...",
  "DATABASE_URL": "postgresql://...",
  "TELEGRAM_BOT_TOKEN": "...",
  "TELEGRAM_CHAT_ID": "...",
  "POLAR_ACCESS_TOKEN": "...",
  "SUCCESS_URL": "https://tom.so/thanks",
  "INTERNAL_API_TOKEN": "...",
  "GITHUB_TOKEN": "...",
  "GITHUB_CLIENT_ID": "...",
  "GITHUB_CLIENT_SECRET": "...",
  "GOOGLE_CLIENT_ID": "...",
  "GOOGLE_CLIENT_SECRET": "...",
  "BETTER_AUTH_SECRET": "...",
  "CMS_ADMIN_EMAILS": "tom@example.com",
  "TOM_CMS_ADMIN_EMAILS": "tom@example.com",
  "SOPHIE_CMS_ADMIN_EMAILS": "sophie@example.com",
  "SOPHIE_BETTER_AUTH_SECRET": "...",
  "SOPHIE_INTERNAL_API_TOKEN": "...",
  "CONTROL_TOKEN": "...",
  "TURBO_CACHE_TOKEN": "...",
  "TURBO_CACHE_SIGNATURE_KEY": "..."
}
```

Per-tenant keys (`TOM_*`/`SOPHIE_*`) resolve under the shared names with
shared-value fallback, so existing deploys keep working until the distinct
keys are set. Explicit worker env wins over bundle values. Missing
`TOM_CMS_ADMIN_EMAILS`/`SOPHIE_CMS_ADMIN_EMAILS` fail the deploy (fail
closed); Sophie never inherits the shared allowlist.

`GITHUB_TOKEN` is a fine-grained PAT scoped to the target repository with
**Administration: write** permission (used to mint runner registration
tokens). `CONTROL_TOKEN` guards the runner control endpoints; generate a long
random value of at least 32 characters.

`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are the GitHub OAuth app
credentials for Tom CMS sign-in (distinct from the runner `GITHUB_TOKEN`).
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are the Google OAuth
credentials for Sophie CMS sign-in.
`BETTER_AUTH_SECRET` signs sessions (min 32 chars; `openssl rand -base64 32`).
`CMS_ADMIN_EMAILS` is the comma-separated allowlist for sign-in; everyone else
is rejected before a user row is created.

`TURBO_CACHE_TOKEN` (bearer token for the turbo remote cache) and
`TURBO_CACHE_SIGNATURE_KEY` (artifact signature key, min 32 bytes) protect the
cache. Generate both with `openssl rand -hex 32`; store the same values as the
`TURBO_CACHE_TOKEN` and `TURBO_CACHE_SIGNATURE_KEY` GitHub Actions repository
secrets (`TURBO_REMOTE_CACHE_SIGNATURE_KEY` is Turbo's client-side name for the
latter).

`INTERNAL_API_TOKEN` is the shared secret the adapter presents as the
`x-internal-token` header when calling the API's protected routes
(`/og`, `/checkout`, `/portal`, `/auth/*`). Generate a long random value; requests
without a matching token are rejected with 401.

`DATABASE_URL` is also used to configure the Hyperdrive origin. At runtime,
web code prefers the `HYPERDRIVE` binding’s connection string.

## Performance telemetry

Stages listed in `otelEnabledStages` (production, staging, `pr-*`, `perf-*`)
bind the Axiom ingest token and export OTLP traces/logs with a `stage`
resource attribute, so the performance harness can compare a candidate
stage against `staging`. Workers on other stages stay console-only.

The shared stack also mints a read-only Axiom query token
(`wwwtom-otel-query`) and mirrors it into the Secrets Store as
`AXIOM_QUERY_TOKEN`. Copy that value from the Cloudflare Secrets Store into
the GitHub Actions repository secret `AXIOM_QUERY_TOKEN`; the perf workflow
uses it to run APL queries. Querying Cloudflare Workers analytics
additionally needs a token with Account Analytics: Read (the existing
`CLOUDFLARE_API_TOKEN`, or a dedicated `CLOUDFLARE_ANALYTICS_TOKEN`).

GitHub runner IPs trip Cloudflare bot protection, so the perf probe needs a
WAF skip rule for a secret `x-perf-probe` header on non-production hosts
(dashboard prerequisite; see `apps/e2e/README.md` for the same restriction).

### Performance harness

`infra/perf` compares a candidate stage against `staging` on server-side
metrics: Workers invocation CPU/wall time, errors, and subrequests (GraphQL
Analytics API) plus span p95 per operation (Axiom, filtered by the `stage`
annotation). It probes both stages with the same read-only request mix in one
window and reports medians and deltas; thresholds live in
`infra/perf/compare.ts`.

- PR run: `pnpm --filter @tom/infra perf:pr` with `PULL_REQUEST` (or
  `PERF_CANDIDATE_STAGE`), `CLOUDFLARE_ACCOUNT_ID`, and
  `CLOUDFLARE_ANALYTICS_TOKEN` (or `CLOUDFLARE_API_TOKEN`). Set
  `AXIOM_QUERY_TOKEN` for span latency and `PERF_PROBE_TOKEN` when the WAF
  rule is active. The report is written to `perf-report.json` and
  `perf-report.md`, logged, and appended to `GITHUB_STEP_SUMMARY` when set.
- Preview workflow: the `perf` job runs the harness automatically after the
  preview deploy (same `pr-<n>` stage), updates one marker comment per PR
  with the report, and uploads the JSON artifact for 14 days.
- Manual isolated run: `PERF_LIVE=1 ALCHEMY_TEST_STAGE=perf-local pnpm
--filter @tom/infra perf:live` deploys the candidate stacks with the
  Alchemy Test API, measures them, then destroys them. The `perf-` prefix is
  required for OTLP export.

## Previews

When `PULL_REQUEST` is set, the web, editor, and sophie stacks post or
update GitHub preview comments (Web, Tom CMS, Sophie Web, Sophie CMS).
Preview stages should use `ALCHEMY_STAGE=pr-<number>`.

Preview editors authenticate through the dev adapters: OAuth redirect
URIs are exact-match at Google/GitHub, so per-PR hosts can never be
registered. The dev APIs trust each PR's editor origin
(`pr-<n>-cms.tom.so`, `pr-<n>-cms.sophie.st`).
