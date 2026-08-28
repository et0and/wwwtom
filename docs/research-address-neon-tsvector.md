# Research: address.run port to wwwtom with Neon + tsvector + read replica + 3-char debounce

Branch: `research/address-neon-tsvector` (worktree `eager-kiwi` at `c97fb32`).
Clone: `~/Documents/Dev/address` cloned from https://github.com/et0and/address at `eeeb915`.

This doc records the investigation. It proposes the smallest correct change that follows wwwtom patterns.

## 1. Source system (et0and/address)

- Runtime: Cloudflare Workers, Bun, `effect` `^3.19.19` + `@effect/platform` `^0.94.5` (`apps/api` uses `elysia` `1.4.29` + `effect` `4.0.0-beta.99`; do not copy Bun idioms directly)
- Storage: D1 SQLite + `fts5` virtual table `addresses_fts` with content sync triggers (`schema.sql:59`, `schema.sql:77`), `bm25` ranking (`src/services/search.ts:338`), `search_terms` + `search_aliases` auxiliaries (`schema.sql:132`)
- Search plan: tokenize + normalize (`src/services/search.ts:30`), alias expansion (`src/services/search.ts:126`), levenshtein typo correction (`src/services/search.ts:71`, `src/services/search.ts:160`), 3-plan fallback `exact` → `expanded` → `fuzzy` (`src/services/search.ts:356`)
- API: `@effect/platform` `HttpApi` groups (`src/api/routes.ts:34`), `Auth`/`Admin` `HttpApiMiddleware.Tag`, `Schema.TaggedError` → HTTP status
- Ingest: LINZ WFS `layer-105689` paged JSON + `Queues` + `scheduled` cron (`src/worker.ts:96`, `src/worker.ts:188`), `address_postcodes` auxiliary

## 2. Prior wwwtom port (reference, do not merge as-is)

- Branch `feature/address-service-port` commit `02fda33bb7603c444ac6fe6bf0d86e1f96f1546b` already ports the service to Neon Postgres.
- Schema: `search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', concat_ws(...))) STORED` + `GIN` index (`apps/api/src/services/address/schema.ts:231`). This is the correct direction for Postgres.
- Search: `toTsQuery` converts `token*` → `token:*` and `AND/OR` → `&/|`, then `a.search_vector @@ q.query` + `ts_rank` (`apps/api/src/services/address/search.ts:356`). Alias + levenshtein retained.
- DB layer: `drizzle-orm` + `pg` `Pool` + `@effect/sql-pg` + `Hyperdrive` (`apps/api/src/services/address/db.ts:1`). wwwtom today uses `kysely` `catalog:` + `postgres` `catalog:` via `kysely-postgres-js` (`packages/@tom/db/package.json:14`), `Hyperdrive` for `guestbook-hyperdrive` (`infra/hyperdrive/web.hyperdrive.ts:1`). Keep the Kysely path for consistency unless you deliberately migrate all DB code.
- Infra: `ADDRESS_DB` in `TOM_SECRETS` → `addressHyperdrive` (`infra/hyperdrive/address.hyperdrive.ts:1`), `TOM_RATE_LIMIT_KV` reuse, `nodejs_compat` for `pg` (not needed if you stay on `postgres.js`).

## 3. Target design (recommendation)

### 3.1 Postgres text search (tsvector / tsquery)

Use one `tsvector` column, not FTS5 triggers.

```sql
search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('simple',
    concat_ws(' ',
      coalesce(full_address,''),
      coalesce(full_address_ascii,''),
      coalesce(full_road_name,''),
      coalesce(full_road_name_ascii,''),
      coalesce(road_name,''),
      coalesce(road_name_ascii,''),
      coalesce(road_type_name,''),
      coalesce(road_type_name_ascii,''),
      coalesce(suburb_locality,''),
      coalesce(suburb_locality_ascii,''),
      coalesce(town_city,''),
      coalesce(town_city_ascii,'')
    )
  )
) STORED;

CREATE INDEX addresses_search_idx ON addresses USING GIN (search_vector);
CREATE INDEX idx_addresses_town_city ON addresses (town_city);
CREATE INDEX idx_addresses_suburb_locality ON addresses (suburb_locality);
CREATE INDEX idx_addresses_lat ON addresses (lat);
CREATE INDEX idx_addresses_lng ON addresses (lng);
```

Why `simple`: LINZ data is English + Māori ascii; `simple` prevents English stemming from breaking macrons and abbreviations. Add `unaccent` extension if you want `Mt` vs `Mount` without alias table (keep alias table anyway for `rd` → `road` business logic).

Query:

```sql
SELECT a.*, p.postcode
FROM addresses a
LEFT JOIN address_postcodes p ON p.address_id = a.address_id
CROSS JOIN to_tsquery('simple', $1) AS q(query)
WHERE a.search_vector @@ q.query
ORDER BY ts_rank(a.search_vector, q.query) DESC
LIMIT $2;
```

`$1` is the `toTsQuery(plan.match)` string. `ts_rank` replaces `bm25`. For prefix search, use `:*` on each token (`lambton:* & quay:*`). The prior port already implements `toTsQuery` correctly (`apps/api/src/services/address/search.ts:110`).

Keep `search_terms` + `search_aliases` auxiliaries with `TRIGRAM` or `BTREE` for correction. Do not drop them; they give typo tolerance that `tsvector` lacks.

Semantic note: `tsvector`/`tsquery` is lexical, not vector-embedding semantic. If you need embedding semantic, add `pgvector` + `ivfflat` index on a separate `embedding vector(1536)` column and blend `ts_rank + cosine` in `ORDER BY`. Out of scope for first slice; name it optional phase 2.

### 3.2 Neon + Hyperdrive + read replica

wwwtom already routes `DATABASE_URL` through Hyperdrive (`packages/@tom/utils/src/services/config.ts:167`, `infra/hyperdrive/web.hyperdrive.ts:30`). For address:

- Provision Neon project with two endpoints: `primary` (read-write) + `replica` (read-only). Neon creates a read replica as a separate endpoint / branch; both share storage, replica lags < 100 ms in same region.
- Store two URLs: `ADDRESS_DB` (primary) and `ADDRESS_DB_REPLICA` (read endpoint). Add both to `TomSecretsSchema` and `secretKeys` (`packages/@tom/utils/src/services/config.ts:92` pattern).
- Code: `AddressDbService` holds two Pools/Kysely instances:

```ts
const primary = getDb(ADDRESS_DB);    // writes: ingest, migrations, api_keys
const replica = getDb(ADDRESS_DB_REPLICA); // reads: search, list, getById, reverse, meta
const runRead  = query(replicaConnectionString);
const runWrite = query(primaryConnectionString);
```

- Infra: `infra/hyperdrive/address.hyperdrive.ts` pattern extends to two bindings `ADDRESS_HYPERDRIVE` + `ADDRESS_HYPERDRIVE_REPLICA`, or a single Hyperdrive with Neon replica host if Hyperdrive supports replica routing (it does not route writes vs reads; use two bindings).
- Worker runtime already supports `HYPERDRIVE: { connectionString: string }` (`packages/@tom/db/src/service.ts:104`); add `ADDRESS_HYPERDRIVE`/`ADDRESS_REPLICA_HYPERDRIVE` to `CloudflareEnv`.
- Failure mode: if replica is absent (local dev, `ALCHEMY_DEV`), fall back to primary (`|| primary`).

Cost/perf: Neon autosuspends idle replica; Hyperdrive pools across isolates and cuts IAM handshakes. Replica isolates search load from ingest writes and guestbook OLTP.

### 3.3 3-char debounce (frontend + API)

Requirement: 3 char minimum before search, with debounce.

Frontend (SolidStart, `apps/web`):
- Use `createSignal` + `createEffect` + `createMemo` pattern (`apps/web/AGENTS.md`). Do not use `createEffect` to set state; use debounce via `setTimeout` + `onCleanup`.
- Minimal primitive:

```ts
const [query, setQuery] = createSignal("");
const [debounced, setDebounced] = createSignal("");
createEffect(() => {
  const q = query();
  if (q.trim().length < 3) { setDebounced(""); return; }
  const id = setTimeout(() => setDebounced(q.trim()), 250);
  onCleanup(() => clearTimeout(id));
});
const results = createResource(debounced, (q) => q ? fetchSearch(q) : Promise.resolve([]));
```

- Use `@tanstack/solid-query` (already in `apps/web/package.json`) with `enabled: debounced().length >= 3` as alternative.

API guard:
- In `routes/addresses.ts`, validate `q.trim().length >= 3`; return `400 ValidationError` if shorter. This prevents replica load from single-char prefix scans (`a:*` would match ~50% of tsvector). Keep `limit` clamp `parseLimit` already present.

Cache:
- Add `Cache-Control: public, max-age=300, stale-while-revalidate=60` for `GET /v1/search` when `q` hits; Cloudflare caches at edge and reduces replica QPS.

### 3.4 Effect + Elysia alignment (wwwtom)

Do not copy `HttpApi`/`HttpApiMiddleware.Tag` from `address` (`src/api/routes.ts:1`). wwwtom API uses `elysia` + `CloudflareAdapter` + `runEffect`/`logContextFromRequest` (`apps/api/src/index.ts:1`). Follow the prior port's `createAddressRoutes(getServices)` pattern (`apps/api/src/routes/addresses.ts` in `02fda33`), which adapts cleanly:

- `services/address/index.ts` exposes `AddressServices` with `Effect.Effect<..., HttpError>` methods.
- Routes use `runRoute(effect, request)` with `Effect.catch` → `toErrorResponse` and `Effect.logWarning` for 404/validation (`apps/api/src/index.ts:64`).
- Use `AppConfig` + `getRequestEnv` + `readCloudflareEnv` for secrets, not raw `env` (`packages/@tom/utils/src/services/config.ts:107`).
- Keep `nodejs_compat` out if you stay on `postgres.js`; add it only if you keep `pg`.

### 3.5 Ingest

Reuse LINZ WFS ingest from `src/services/ingest.ts` but run via `ctx.waitUntil` + `tom.queue` or direct `Effect` loop; `Workers Queues` + `DO RateLimiter` is already in use for adapter (`infra/queues/tom.queue.ts`). For first slice, run ingest as `POST /ingest-init` (`X-Admin-Key` guard) that enqueues `PAGE_SIZE = 1000` fetches and awaits `pg` upserts in batches. Do not block the request; return `202`.

## 4. File map (where to change)

- `packages/@tom/types/src/db.ts` — add `addresses` + `dataset_version` + `search_*` + `address_postcodes` types
- `packages/@tom/db/src/migrations/0002_address.ts` — create `ADDRESS_SCHEMA_STATEMENTS` via Kysely schema builder (prefer over raw SQL for parity with `0001_initial.ts:11`)
- `packages/@tom/utils/src/services/config.ts` — add `ADDRESS_DB`, `ADDRESS_DB_REPLICA`, `ADDRESS_ADMIN_KEY`, `ADDRESS_API_KEY_SALT`, `ADDRESS_POW_SECRET` to `CloudflareEnv` + `secretKeys`
- `infra/hyperdrive/address.hyperdrive.ts` (new) + `infra/hyperdrive/address-replica.hyperdrive.ts` — two `Cloudflare.Hyperdrive.Connection`
- `infra/apps/api.run.ts` — bind `ADDRESS_DB` / `ADDRESS_DB_REPLICA` + `TOM_RATE_LIMIT_KV` (`infra/kv/api.kv.ts` pattern) + `ADDRESS_HYPERDRIVE*`
- `apps/api/src/services/address/*` (new) — `schema.ts`, `db.ts` (Kysely version of prior port), `search.ts` (tsvector), `addresses.ts`, `abuse.ts`, `rate-limiter.ts`, `proof.ts`, `ingest.ts`
- `apps/api/src/routes/addresses.ts` (new) — Elysia group, re-exported via `apps/api/src/index.ts:81`
- `apps/web/src/components/AddressSearch.tsx` (new) — Solid component with 3-char debounce, `For`/`Show`/`Suspense`, `class` not `className` (`apps/web/AGENTS.md`)
- `apps/web/src/routes/search.tsx` (optional) — page for demo

## 5. Risks / open questions

- `postgres.js` vs `pg`: `postgres.js` is Worker-safe via Hyperdrive; `pg` needs `nodejs_compat` and `Pool` finalizer care (`drizzle` port uses `Pool`). Decide before code.
- Neon replica lag: search may lag ingest by seconds; acceptable for addresses. Document `stale-while-revalidate`.
- `tsvector` generation cost: `STORED` column rewrites on update; bulk ingest should `COPY` or batched `INSERT ... ON CONFLICT`.
- Rate limiting: reuse `TOM_RATE_LIMIT_KV` + DO (`src/limits.ts` in address) or move to KV-only (`apps/api/src/services/address/rate-limiter.ts` in prior port).
- Secrets: `TOM_SECRETS` bundle is account-level and retained (`infra/shared.run.ts:80`); document required keys in `.dev.vars` template.

## 6. Next steps (tickets)

1. `DB: address schema + migrations (tsvector GIN)` — define Kysely migration, add `search_vector`
2. `Infra: Neon + Hyperdrive (primary + replica)` — provision Neon, add Hyperdrive bindings, update `config.ts`
3. `API: AddressServices (Effect)` — `db.ts` (Kysely), `search.ts` (toTsQuery + alias + levenshtein)
4. `API: Elysia routes + auth (X-API-Key, X-Admin-Key, PoW)` — `routes/addresses.ts`, `proof.ts`, `abuse.ts`
5. `API: ingest (LINZ WFS) + meta` — `ingest.ts`, `regions.ts`
6. `Web: AddressSearch component (3-char debounce, 250 ms)` — Solid + `@tanstack/solid-query`
7. `Ops: rate limit + cache headers + read-replica routing` — verify `HYPERDRIVE_REPLICA` fallback

Verification: `pnpm --filter @tom/db run migrate`, `pnpm --filter @tom/api run test` (`apps/api/src/__tests__/addresses.test.ts` from `02fda33`), `pnpm --filter @tom/web run test`, manual `curl -H x-api-key:... /v1/search?q=qua` → expect `400` for `<3`, `curl /v1/search?q=lambton` → expect GIN scan + `ts_rank` order.
