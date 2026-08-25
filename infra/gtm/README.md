# infra/gtm — Google Tag Manager as Code

Alchemy + Effect provider set for the GTM Configuration API (`tagmanager.googleapis.com/tagmanager/v2`). Manages `Account` (adopt-only), `Container`, `Workspace`, `Tag`, and `Trigger` resources with the same `Stack`/`Stage` lifecycle as the rest of `wwwtom`.

- Discovery doc pinned at `schemas.ts:1` — `https://tagmanager.googleapis.com/$discovery/rest?version=v2`.

## Architecture

```
GtmCredentials (OAuth refresh → access token, cached per run)
      ↓
GtmHttp (Fetch + Bearer, typed errors: NotFound/Conflict/InvalidArgument/HttpError)
      ↓
Provider set: Account | Container | Workspace | Tag | Trigger  (alchemy/Resource)
      ↓
Stack "wwwtom-gtm" (Cloudflare.state for persistence)
```

- Ownership via `[alchemy:stack=…;stage=…;id=…]` marker appended to the GTM `notes`/`description` field. `Unowned` read results are left alone unless deployed with `--adopt`.
- `fingerprint` is threaded on every `update*` for optimistic concurrency (GTM returns `409` otherwise).
- List responses include `nextPageToken` — providers use `list*` only for adopt-by-name lookup, so pagination is not material for slice 1.

## Prerequisites

1.  A Google Cloud project with the **Tag Manager API** enabled.
2.  An OAuth consent screen (External or Internal) + OAuth Client ID of type **Web application**.
3.  A GTM **Account** (you cannot create one via the API — `Account` is ref-only).
4.  `tagmanager.googleapis.com` scopes granted to the refresh token:
    - `https://www.googleapis.com/auth/tagmanager.edit.containers`
    - `https://www.googleapis.com/auth/tagmanager.edit.containerversions`
    - `https://www.googleapis.com/auth/tagmanager.manage.accounts` (for `Account.get` / adoption checks)

## Getting credentials

The provider uses the standard OAuth web flow to mint a long-lived refresh token. One-time setup:

```bash
# 1. Create the client in Console → APIs & Services → Credentials
#    Authorized redirect URI: http://localhost:8080/callback (example)

# 2. Exchange an auth code for tokens (replace CLIENT_ID/SECRET/CODE):
curl -X POST https://oauth2.googleapis.com/token \
  -d client_id=$GOOGLE_CLIENT_ID \
  -d client_secret=$GOOGLE_CLIENT_SECRET \
  -d code=$OAUTH_CODE \
  -d grant_type=authorization_code \
  -d redirect_uri=http://localhost:8080/callback

# response contains refresh_token — store it
```

Keep the three values as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (see **Environment**).

The runtime never logs the secret or token — both stay in `Redacted` (`credentials.ts:12`).

## Environment

Same pattern as `infra/README.md`:

```bash
# infra/.dev.vars (never committed)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//xxx

# Optional override for tests against the simulator
# GTM_API_BASE=http://localhost:8789/tagmanager/v2
```

Alchemy loads this file via `ALCHEMY_ENV_FILE` (default `infra/.dev.vars`). In CI set the three vars as encrypted secrets and export them before `pnpm deploy`.

## Quick start — inside wwwtom

```ts
// infra/gtm/gtm.run.ts — foundation slice declares no resources.
// Add your own in a later slice or in a stage-specific branch:

import { Container } from "./container.ts";
import { Workspace } from "./workspace.ts";
import { Trigger } from "./trigger.ts";
import { Tag } from "./tag.ts";

export default Stack(
  "wwwtom-gtm",
  { providers: gtmProviders(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const account = yield* Account("primary", { path: "accounts/123456" });

    // Production adopts the existing container; other stages create their own.
    const container = yield* Container("web", {
      accountPath: account.path,
      name: ALCHEMY_STAGE === "production" ? "tom.so" : `tom.so-${ALCHEMY_STAGE}`,
      usageContext: ["WEB"],
      domainName: ["tom.so"],
    });

    const ws = yield* Workspace("default", {
      containerPath: container.path,
      name: "default",
      description: "Managed by alchemy",
    });

    const trigger = yield* Trigger("pageview", {
      workspacePath: ws.path,
      name: "All Pages",
      type: "pageview",
    });

    yield* Tag("ga4-pageview", {
      workspacePath: ws.path,
      name: "GA4 — Pageview",
      type: "gaawc", // or "sp" etc. — see GTM Gallery
      parameter: [{ type: "template", key: "tid", value: "G-XXXX" }],
      firingTriggerId: [trigger.triggerId],
    });

    return { container, workspace: ws };
  }),
);
```

Deploy:

```bash
ALCHEMY_STAGE=dev pnpm --filter @tom/infra exec alchemy deploy gtm.run.ts --stage $ALCHEMY_STAGE
# or via the helper
ALCHEMY_STAGE=dev pnpm deploy:gtm
```

Local plan without touching GTM:

```bash
ALCHEMY_STAGE=dev pnpm --filter @tom/infra exec alchemy plan gtm.run.ts --stage dev
```

## Standalone / spin-off

The module has no `wwwtom`-specific imports beyond `alchemy` + `effect`. To extract:

```bash
mkdir gtm-standalone && cp -r infra/gtm infra/package.json infra/tsconfig.json infra/vitest.config.ts gtm-standalone/
cd gtm-standalone
pnpm install
# set the three GOOGLE_* vars and run:
ALCHEMY_STAGE=dev npx alchemy deploy gtm.run.ts --stage dev
```

Required deps: `alchemy@2.0.0-beta.72`, `effect@4.0.0-beta.105`, `vite`. No Cloudflare binding is required until you add a `Cloudflare.state()` — swap in `FileSystem.state({ rootDir: "./.alchemy" })` for a fully local standalone.

## Testing

```bash
# unit (fake GTM, no network)
pnpm --filter @tom/infra test          # 26 tests
pnpm --filter @tom/infra exec vitest run gtm --coverage

# live integration (hits real GTM — creates and deletes an ephemeral container)
GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_REFRESH_TOKEN=… \
GTM_TEST_ACCOUNT=accounts/123456 \
pnpm --filter @tom/infra exec vitest run gtm --run gtm/__tests__/live.int.test.ts
```

`makeFakeGtmHttpLayer` (`http.ts:294`) mirrors GTM's `409` on duplicate names and bumps `fingerprint` on updates. The `adapter`/`simulator` pattern (`apps/simulator/src/index.ts:13` + `x-use-simulator` header) can be reused for GTM by adding a `GTM_API_BASE` override to `GtmHttpLive` — the simulator would expose `POST /tagmanager/v2/**` fixtures the same way `payload.ts` does.

## Troubleshooting

- `CredentialsError: GOOGLE_* must be set` — env not loaded. Check `ALCHEMY_ENV_FILE` and that `infra/.dev.vars` is quoted correctly.
- `409 Conflict` on update — stale `fingerprint`. The provider refreshes it via `list*` before `update`; if you mutated the resource in the UI between `plan` and `deploy`, re-run.
- `403` — refresh token lacks scopes or GTM account permission. Re-authorize with the scopes listed above.
- `Adopt` vs create — first production deploy against an existing container/workspace must be run as `alchemy deploy gtm.run.ts --stage production --adopt` (or `adopt(true)` in the stack) — subsequent deploys are idempotent.

## References

- [GTM API v2 overview](https://developers.google.com/tag-platform/tag-manager/api/v2.md.txt)
- [REST reference](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2)
- Discovery: `https://tagmanager.googleapis.com/$discovery/rest?version=v2`
