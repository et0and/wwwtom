# @tom/infra

Cloudflare infrastructure for `wwwtom`, managed with Alchemy V2 and
Effect V4.

## Managed apps

- `apps/web`: SolidStart 2, built by `Cloudflare.Website.Vite`
- `apps/api`: Elysia Worker
- `apps/adapter`: Elysia BFF Worker (integrations: arena, payload, polar, guestbook, github, image, og)
- `turbo-cache`: KV-backed Turborepo remote cache (`turbo-cache.tom.so`) for CI/CD
- `gtm`: Google Tag Manager configuration as code (`infra/gtm` — see `gtm/README.md`)
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
pnpm deploy:web
pnpm deploy:runner
pnpm deploy:turbo-cache
pnpm deploy:gtm
```

Deployment order is `shared -> turbo-cache -> api -> adapter -> web`. `gtm` is
independent and can be deployed at any time.

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
(`web -> adapter -> api -> turbo-cache -> shared`).

Local dev for the adapter (workerd + real bindings from `alchemy dev`):

```bash
pnpm dev:adapter
```

The adapter runs on `http://localhost:8788`; local secrets are split out of the
`TOM_SECRETS` bundle because Secrets Store bindings are not supported in local
mode.

## Turbo remote cache

The `turbo-cache` stack implements the Turborepo remote-cache protocol
(`/v8/artifacts/{hash}` GET/HEAD/PUT, `/v8/artifacts/status`, and
`/v8/artifacts/events`) on a Cloudflare KV namespace, so CI runs share task
artifacts and skip work that another run already did.

- The production worker lives at `https://turbo-cache.tom.so`; other stages
  get `{stage}-turbo-cache.tom.so`.
- Artifacts are gzip-compressed tarballs capped at Cloudflare KV's 25 MiB value
  limit (oversized uploads fail with 413) and expire after 7 days.
- Every route requires `Authorization: Bearer <token>`. The token is read from
  the TOM_SECRETS bundle as `TURBO_CACHE_TOKEN` (min length 32) and must also
  be stored as a GitHub Actions repository secret.

Point Turbo 2.x at it from CI or a local shell:

```bash
export TURBO_API=https://turbo-cache.tom.so
# Same value as the TURBO_CACHE_TOKEN entry in the TOM_SECRETS bundle.
export TURBO_TOKEN=<token>
export TURBO_TEAM=wwwtom  # required or Turbo keeps remote caching disabled
```

Local dev for the cache worker (workerd + real bindings from `alchemy dev`):

```bash
pnpm dev:turbo-cache
```

The cache worker runs on `http://localhost:8790` by default. Deploy with
`pnpm deploy:turbo-cache`.

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
  "PAYLOAD_URL": "https://cms.tom.so",
  "DATABASE_URL": "postgresql://...",
  "TELEGRAM_BOT_TOKEN": "...",
  "TELEGRAM_CHAT_ID": "...",
  "POLAR_ACCESS_TOKEN": "...",
  "SUCCESS_URL": "https://tom.so/thanks",
  "INTERNAL_API_TOKEN": "...",
  "GITHUB_TOKEN": "...",
  "CONTROL_TOKEN": "..."
}
```

`GITHUB_TOKEN` is a fine-grained PAT scoped to the target repository with
**Administration: write** permission (used to mint runner registration
tokens). `CONTROL_TOKEN` guards the runner control endpoints; generate a long
random value of at least 32 characters.

`INTERNAL_API_TOKEN` is the shared secret the adapter presents as the
`x-internal-token` header when calling the API's protected routes
(`/og`, `/checkout`, `/portal`). Generate a long random value; requests
without a matching token are rejected with 401.

`DATABASE_URL` is also used to configure the Hyperdrive origin. At runtime,
web code prefers the `HYPERDRIVE` binding’s connection string.

## Previews

When `PULL_REQUEST` is set, the web stack posts or updates a GitHub preview
comment. Preview stages should use `ALCHEMY_STAGE=pr-<number>`.
