# Commercial Auth Plan - Chained from research/address-neon-tsvector

This branch is parked and chained. Base is `research/address-neon-tsvector`. Head is `feat/auth-better-auth-d1-saml-oauth`.

Purpose: add SAML SSO, OAuth2, and API key management for commercial use of the address service. Auth DB uses D1 via Alchemy. This keeps tenant isolation and multi tenant naturally.

## Stack

- **Better Auth** via `npx skills add better-auth/skills` - installed in this branch at `.agents/skills/better-auth-*`.
- **Auth DB:** Cloudflare D1 via Alchemy `Cloudflare.D1.Database`. D1 gives SQLite per tenant isolation, low cost, and Workers native binding.
- **API DB:** Neon Postgres for addresses stays via Hyperdrive. No mix.
- **Workers:** `api.tom.so` handles auth routes at `/api/auth/*` and address routes at `/v1/*`.

## What to build when commercialising

1. **Install Better Auth**
   - `pnpm add better-auth`
   - `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `TOM_SECRETS`.
   - `auth.ts` in `apps/api/src/lib/auth.ts` with D1 adapter.

2. **D1 adapter**
   - Use `better-auth/adapters/drizzle` with `drizzle-orm/d1`.
   - Drizzle provider is `sqlite`.
   - Alchemy creates D1 in `infra/shared.run.ts` or `infra/apps/api.ts` and binds to Worker as `AUTH_DB`.
   - Example Alchemy:
     ```ts
     const authDb =
       yield *
       Cloudflare.D1.Database("wwwtom-auth-d1", {
         name: "wwwtom-auth-d1",
         migrations: "./apps/api/drizzle/auth",
       });
     ```

3. **Plugins for commercial features**
   - `sso` plugin for SAML SSO - IdP config per organization.
   - `organization` plugin for multi tenant - each tenant is an organization.
   - `apiKey` plugin for service keys - users generate keys after login, keys scope to organization.
   - `admin` plugin for user management.
   - `oAuthProxy` if needed for provider token exchange.

4. **SAML SSO**
   - Enable `sso` plugin: `sso: { organizationId, saml: { ... } }`.
   - Store IdP metadata per organization in D1.
   - Flow: user logs in via IdP -> Better Auth creates session -> organization membership checked -> issue API key.

5. **OAuth2**
   - Enable `socialProviders: { github: { clientId, clientSecret } }` (GitHub wired on dev).
   - Clients use PKCE; GitHub OAuth app must allowlist the exact `redirect_uri` Better Auth emits = `BETTER_AUTH_URL/api/auth/callback/github`.
   - Redirect URIs to register in the GitHub OAuth app per environment (do not use a dashboard/page URL — it must be the callback path):
     - local dev (api worker): `http://localhost:8787/api/auth/callback/github`
     - dev stage (this branch): `https://dev-api.tom.so/api/auth/callback/github`
     - production: `https://api.tom.so/api/auth/callback/github`
   - If the auth base path changes, update the registered redirect URIs accordingly.

6. **API key generation**
   - After login, call `auth.api.createApiKey({ name, prefix, expiresIn })`.
   - Store hashed key in D1 `apikey` table. User sees key once.
   - Middleware on `/v1/*` checks `x-api-key` header against D1 via `verifyApiKey`.

7. **D1 multi tenant**
   - Each organization has row in `organization` table.
   - `member`, `apiKey`, `ssoConfig` link to `organizationId`.
   - D1 queries filter by `organizationId`. No cross tenant leak.
   - Alchemy D1 binding is per Worker, not per tenant. Tenant isolation is app level via column, not DB per tenant. For strict DB per tenant, create D1 per organization via Alchemy dynamic, but column filter is cheaper.

## Routes to add

- `POST /api/auth/sign-in/sso` - SAML entry
- `POST /api/auth/sign-in/oauth2` - OAuth2
- `GET /api/auth/organization` - list orgs
- `POST /api/auth/api-key` - create key
- `GET /api/auth/api-key` - list keys
- `DELETE /api/auth/api-key/:id` - revoke

## Migrations

- `npx @better-auth/cli@latest generate --output apps/api/src/db/auth-schema.ts --provider sqlite`
- `pnpm drizzle-kit push` for D1 via wrangler.

## Chained PR strategy

- Base PR is #112 research/address-neon-tsvector. Merge that first.
- This branch `feat/auth-better-auth-d1-saml-oauth` is chained. It adds only auth files. No conflict with address search.
- When commercialising, open PR from this branch to `dev` after base merges.
- Keep D1 out of address DB. Do not put auth tables in Neon.

## Next step when un-parked

- Add `BETTER_AUTH_SECRET` generation via `openssl rand -base64 32` to `TOM_SECRETS`.
- Wire `auth.ts` and mount `toNodeHandler(auth)` or Elysia `mount` at `/api/auth`.
- Add Alchemy D1 resource and bind to `api` Worker.
