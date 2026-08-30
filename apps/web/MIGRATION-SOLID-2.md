# Solid 2 migration (apps/web)

Source of truth: <https://v2.solidjs.com/migration/from-solid-1>

Goal: migrate Solid 1 + SolidStart 2.0.0-beta.9 to Solid 2 core. SolidStart is
removed entirely — `@solidjs/vite-plugin` (`start: true, ssr: true`) is the
serving layer, and `@solidjs/web` owns rendering, request events, and response
heads.

## Recorded Solid 1 baselines (2026-08-06)

- Unit tests: 62/62 pass (`pnpm --filter @tom/web test -- --run`)
- Production build: passes (`pnpm --filter @tom/web build`)
- Typecheck: fails on one **pre-existing unrelated** error in
  `apps/api/src/internal.ts` (TS7030, from `feat: auth on api`) pulled in via
  the `@tom/adapter → @tom/api` import graph; not caused by or fixed by this
  migration.
- e2e: not run at baseline (needs local simulator + adapter).

## Migration status (after this change set)

- Unit tests: **53/53 pass** (removed the now-dead `query-dehydration` lib +
  its test — tanstack v6 serializes the cache via its own hydration
  channel).
- Typecheck: web + @tom/ui clean (one pre-existing unrelated `@tom/api`
  TS7030 remains).
- e2e: **29/29 pass** locally (`apps/e2e` booting simulator + adapter +
  `vite dev`), run **fully parallel** (`fullyParallel: true`, default
  workers): Solid 2 scopes each request with `node:async_hooks`
  (`provideRequestEvent`), and the web app creates a fresh query cache per
  request (`middleware` → `locals.queryClient`), so parallel SSR renders and
  pages never share TanStack state. Wall-clock ~12s (was ~26s serial).
- Production build + `vite preview` SSR verified (document rendered, entry
  script + CSS injected from the client manifest, query state serialized).
- Remaining dev-mode diagnostics: 3 `STRICT_READ_UNTRACKED` warnings during
  SPA navigation on data pages — traced to `@tanstack/solid-query`
  6.0.0-beta.8's observer-notify path (pre-release internals), not app code.
- Remaining infra work: adopt the stage deploy (`alchemy`
  `Cloudflare.Website.Vite` + Cloudflare Vite plugin adopting the `ssr`
  environment); verify env/Secrets access through the start-mode handler
  (`options.event` seam) and restore Axiom trace export if required.

## Compatibility boundary

| package               | Solid 1                     | Solid 2                 |
| --------------------- | --------------------------- | ----------------------- |
| solid-js              | 1.9.12 (catalog)            | 2.0.0-rc.4              |
| @solidjs/web          | —                           | 2.0.0-rc.4              |
| @solidjs/router       | 0.15.0                      | 2.0.0-next.19           |
| @solidjs/meta         | 0.29.4                      | 1.0.0-next.2            |
| @solidjs/vite-plugin  | (vite-plugin-solid 2.11.11) | 3.0.0-next.36           |
| @tanstack/solid-query | 5.101.4                     | 6.0.0-beta.8            |
| @solidjs/start        | 2.0.0-beta.9                | removed                 |
| solid-mdx             | 0.0.7                       | removed (no .mdx files) |
| solid-motionone       | 1.0.4 (unused)              | removed                 |

## Architecture after migration

- `vite.config.ts`: `solid({ start: true, ssr: true })`. Dev middleware does
  SSR; `vite build` emits `dist/client` + `dist/server`. Provider hosts adopt
  the `ssr` environment (Alchemy `Cloudflare.Website.Vite`).
- Routing: explicit `createRouter({ routes })` config in `src/router.tsx`
  (replaces `FileRoutes`). Plain `<a>` links replace `<A>`.
- MVP document shell kept in the app + `HydrationScript`; client entry is
  injected by the start-mode build. Query hydration script stays.
- SSR request handling: `@solidjs/web` `createRequestEvent` /
  `provideRequestEvent` / `renderToStream` / `createSSRResponse`.
  `httpStatus()` / `httpHeader()` replace `event.response.headers.set(...)`.
- `src/server/adapter.ts` loses `"use server"`: routes call the adapter
  (Eden treaty) directly; `getAdapterBaseUrl()` keeps the server
  (request-event → env) vs client (inlined `VITE_ADAPTER_URL`) split.
- feed.xml / sitemap.xml / robots.txt move from SolidStart GET routes to
  server-only modules invoked by the server entry.

## Task checklist

- [x] 1. Baselines recorded
- [x] 2. Dependency set: catalog + package.json + install
- [x] 3. tsconfig `jsxImportSource: @solidjs/web`; global.d.ts
- [x] 4. vite.config.ts (start + ssr + middleware); vitest.config.ts
- [x] 5. Router config (`src/router.tsx`) + `app.tsx`
- [x] 6. Entries: `entry-client.tsx` (hydrate), `entry-server.tsx` (render),
     shared `src/Document.tsx` shell
- [x] 7. `server/adapter.ts` (no `use server`), `libs/adapter.ts`
- [x] 8. Route conversions: preload → router config, `httpHeader()`, Loading,
     Errored, async memos, plain links
- [x] 9. Components: Nav/Link/ProgressBar, Arena/CameraRoll/BlurIn\*,
     hold/kawara effects; `Dynamic` replaced by static tags
- [x] 10. feed/sitemap/robots handlers (`src/server/static-routes.ts`)
- [x] 11. Test conversions with `createRouter`+`memoryHistory`
- [x] 12. Verify: typecheck, unit tests (53), build + preview SSR, e2e (29)
- [x] 13. Commit; remaining infra (stage deploy adoption) tracked in
      `infra/apps/web.run.ts` — see Migration status

## Solid 1 → 2 pattern map used here

- `Suspense` → `Loading`; `ErrorBoundary` → `Errored` (error accessor: `err()`)
- `createResource` → async `createMemo` inside `Loading`
- `Index` → `For keyed={false}` (item accessor, numeric index)
- `classList` → object form of `class`
- `mergeProps` → `merge`; `splitProps` → `omit`
- `onMount` → `onSettled`; `on`+effect → split `createEffect(compute, apply)`
- `batch`/`on`/`createDeferred`/`createComputed` — not used or removed
- `Dynamic` → static tag selection in `BlurInText` (Solid 2 `Dynamic` with a
  string element desynced hydration keys; static h1/h2/span branches hydrate
  cleanly)
- Shared `Document` shell hydrated on both sides (client must claim the
  exact server tree, not a `#app` subset)
