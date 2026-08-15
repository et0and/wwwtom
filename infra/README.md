# @tom/infra

Cloudflare infrastructure for `wwwtom`, managed with Alchemy V2 and
Effect V4.

## Managed apps

- `apps/web`: SolidStart 2, built by `Cloudflare.Website.Vite`
- `apps/api`: Elysia Worker
- `apps/adapter`: Elysia BFF Worker (integrations: arena, payload, polar, guestbook, github, image, og)
- `apps/cms`: Payload 3 CMS on Next 16, built by `Cloudflare.Website.Nextjs` (OpenNext)
- `apps/sophie`: Payload CMS on Next 16, built by `Cloudflare.Website.Nextjs` (OpenNext)
- `runner`: ephemeral GitHub Actions runners on Cloudflare Sandboxes (container-backed DO; source + image live in `infra/runner`)

The `production` stage adopts the existing resources instead of replacing
them:

- `wwwtom` on `tom.so`
- `apitom` on `api.tom.so`
- `cmstom` on `cms.tom.so`
- `sophie-cms` (no custom domain)
- `tom-cms` / `sophie-cms` D1 databases
- `sophie-media` R2 bucket
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
pnpm deploy:cms
pnpm deploy:sophie
pnpm deploy:runner
```

Deployment order is `shared -> api -> adapter -> web -> cms -> sophie`.

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
(`sophie -> cms -> web -> adapter -> api -> shared`).

Local dev with workerd parity + real bindings from `alchemy dev`:

```bash
pnpm dev:adapter
pnpm dev:api
pnpm --filter @tom/infra run dev:cms
pnpm --filter @tom/infra run dev:sophie
```

The adapter runs on `http://localhost:8788`. Local secrets are split out of the
`TOM_SECRETS` bundle because Secrets Store bindings are not supported in local
mode. The CMS dev servers use `next dev` (HMR) via `pnpm dev:cms`; the
`alchemy dev` variants (`--filter @tom/infra run dev:cms`) build the OpenNext
worker and serve it under workerd (production parity, no HMR).

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
Cloudflare Secrets Store exposes it to every Worker as `TOM_SECRETS`.

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
  "PAYLOAD_SECRET": "...",
  "CRON_SECRET": "...",
  "S3_BUCKET": "...",
  "S3_ENDPOINT": "https://s3.us-east-005.backblazeb2.com",
  "S3_REGION": "us-east-005",
  "S3_ACCESS_KEY_ID": "...",
  "S3_SECRET_ACCESS_KEY": "...",
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

`PAYLOAD_SECRET` signs the CMS admin JWTs; `CRON_SECRET` guards the CMS jobs
endpoint. The `S3_*` keys configure the CMS media storage (Backblaze B2). The
CMS apps read these from the bundle — add them to the existing production
`TOM_SECRETS` secret before the first Alchemy CMS deploy.

`DATABASE_URL` is also used to configure the Hyperdrive origin. At runtime,
web code prefers the `HYPERDRIVE` binding’s connection string.

## Previews

When `PULL_REQUEST` is set, the web stack posts or updates a GitHub preview
comment. Preview stages should use `ALCHEMY_STAGE=pr-<number>`.
