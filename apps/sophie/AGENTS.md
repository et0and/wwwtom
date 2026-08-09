# Payload Rules (apps/sophie)

Payload 3.75 site for sophie.st: Next 16 + OpenNext Cloudflare, D1 SQLite (`sqliteD1Adapter`), R2 media, lexical editor.

## Commands

- `dev` — next dev, port 3300 | `build` — `next build --webpack` | `lint` — `next lint`
- `typecheck` — `node --stack-size=8192 tsc --noEmit`
- `generate:types` (cloudflare + payload), `generate:importmap`
- `deploy` = `deploy:database` (`payload migrate` + `wrangler d1 execute D1 --command 'PRAGMA optimize' --remote`) → `deploy:app` (opennextjs-cloudflare build/deploy); both need `CLOUDFLARE_ENV`
- `preview` — opennextjs build + preview

## Payload

- Config `src/payload.config.ts`: D1 via `@payloadcms/db-d1-sqlite`; R2 via `@payloadcms/storage-r2`; bindings via `getCloudflareContext()` from `@opennextjs/cloudflare`.
- Security: Local API bypasses access control unless `overrideAccess: false` — ALWAYS set it when passing `user`. Roles: `saveToJWT: true` to avoid DB lookups. Field-level access returns boolean only (no query constraints).
- Hooks: ALWAYS pass `req` to nested operations (transaction atomicity). Context flags (`context.skipHooks`) prevent infinite hook loops. `beforeValidate` = data formatting; `beforeChange` = business logic.
- Log via `payload.logger`.
- Run `generate:types` after schema changes; import types from `payload-types.ts`.
- Components referenced by file path (relative to `admin.importMap.baseDir`), not direct import; named exports need `#ExportName` suffix. Regenerate import map after adding/changing components.
- Custom endpoints: auth-check `req.user`; use `req.payload`; route params `req.routeParams`.
- Drafts/versions: `_status` auto-injected; `draft: true` skips required validation. Relationship default depth 2; `depth: 0` = IDs only.
- Operators: `equals`, `not_equals`, `greater_than`, `less_than_equal`, `contains`, `like`, `in`, `exists`, `near`; combine with `and`/`or`.
- Admin components: Server by default; `'use client'` only for state/effects/handlers/browser APIs. Prefer `useFormFields(([fields]) => fields[path])` over `useForm()`. Admin imports from `@payloadcms/ui`; frontend from `@payloadcms/ui/elements/*`.
- Validate with `tsc --noEmit` after code changes.
