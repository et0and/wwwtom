# @tom/infra

Cloudflare infrastructure for `wwwtom`, managed with Alchemy V2 and
Effect V4.

## Managed apps

- `apps/web`: SolidStart 2, built by `Cloudflare.Website.Vite`
- `apps/api`: Hono Worker

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
```

Deployment order is `shared -> api -> web`.

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
  "SUCCESS_URL": "https://tom.so/thanks"
}
```

`DATABASE_URL` is also used to configure the Hyperdrive origin. At runtime,
web code prefers the `HYPERDRIVE` binding’s connection string.

## Previews

When `PULL_REQUEST` is set, the web stack posts or updates a GitHub preview
comment. Preview stages should use `ALCHEMY_STAGE=pr-<number>`.
