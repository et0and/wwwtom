# wwwtom

pnpm + Turborepo monorepo: tom.so, sophie.st, api.tom.so.
Smallest correct change, follow local patterns, verify before handoff.
Improve existing code; avoid new abstractions.

## Shape

- `apps/web` — Solid 2.0 + Vite (Start mode, no SolidStart package), Workers. Solid rules: `apps/web/AGENTS.md`.
- `apps/sophie` — Solid 2.0 SSR blog for sophie.st (posts, categories, editable About). Same Solid rules.
- `apps/editor` — Solid 2.0 Vite SPA (Tiptap CMS: Tom Camus + Sophie Camus via `VITE_SOPHIE`/`VITE_AUTH_PROVIDER`), Cloudflare Website. Same Solid rules.
- `apps/api` — Elysia (`CloudflareAdapter`) + Effect, Workers. Serves Tom + Sophie tenants via `TENANT`.
- `apps/adapter` — fediverse adapter, Elysia + Effect, Workers. Same tenant split.
- `apps/simulator` — dev-only Elysia/Effect tooling (tsx).
- `packages/*` — ui (TomUI components + OG templates; design rules: `packages/ui/src/tomui/AGENTS.md`), utils, types, db, arena, schemas, checkout, constants, email.
- `infra` — Alchemy 2.0.0-beta.72 + Effect 4.0.0-beta.105 stacks: shared, turbo, api, adapter, web, editor, sophie.

## Working rules

- one function unless composable/reusable
- no unnecessary destructuring; no `else` unless needed; no `try`/`catch` — use Effect
- no `any`; no `let` — prefer `const`; descriptive names
- no Node-only APIs — Workers runtime; prefer web-standard/Worker-safe
- improve existing files, don't rewrite patterns

## Commands (root)

- `pnpm dev` (all via Turbo) | `dev:web` | `dev:editor` | `dev:api` | `dev:adapter`
- `pnpm build` | `lint` | `typecheck` | `test` (Turbo)
- `pnpm format` = `oxfmt --check .`; `pnpm write` = `oxfmt --write .`
- `pnpm test:update` — snapshot update (web, utils, icons)
- `pnpm deploy` = shared → api → adapter → web → editor → sophie (Alchemy; `ALCHEMY_STAGE` required)
- `pnpm deploy:shared|deploy:api|deploy:adapter|deploy:web|deploy:editor|deploy:sophie`
- `pnpm destroy` — destroy current Alchemy stage

## App scripts

- web: `dev|build|start|typecheck|lint|test|test:ui|test:coverage`
- editor: `dev|build|preview|typecheck|lint|test`
- api: `dev|build|deploy|test|typecheck|lint|cf-typegen`

## Single tests

- root filter: `pnpm test -- Nav.test.tsx`
- web: `cd apps/web && npx vitest run Nav.test.tsx` (or `src/components/__tests__/Nav.test.tsx`)
- utils: `cd packages/utils && pnpm vitest run __tests__/telegram.test.ts`

## Tests

- web: `apps/web/src/**/__tests__/*.test.tsx`; jsdom, globals, `src/test/setup.ts` (jest-dom, cleanup, matchMedia mock)
- sophie: `apps/sophie/src/**/__tests__/*`; same Solid setup as web
- editor: `apps/editor/src/**/__tests__/*.test.{ts,tsx}` (`.tsx` for JSX tests — `.ts` skips the JSX transform)
- api: `apps/api/src/__tests__/*`; takumi render stubbed in `src/test/setup.ts`, fonts stubbed per test
- adapter: `apps/adapter/src/__tests__/*`; `requestWithEnv` + `testEnv` in `src/test/helpers.ts`
- ui: `packages/ui/src/**/__tests__/*`
- utils: `packages/utils/__tests__/*`
- Solid UI: `@solidjs/testing-library`; wrap router deps in `Router`/`Route`; assert user-visible behavior; focused snapshots; narrowest relevant test first
- Solid 2.0 writes flush async — await state with `vi.waitFor`, never assert immediately after the action

## TypeScript

- strict; `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`; bundler resolution
- Effect language service plugin (root `prepare: effect-language-service patch`)
- parse unknown input at boundaries; keep internal types trusted
- NEVER `Record<string, unknown|any>` (oxlint `typescript/no-restricted-types`) — model with Effect Schema in `@tom/schemas`; fully-typed records like `Record<string, string>` fine
- don't hand-edit generated `**/worker-configuration.d.ts` / `**/cloudflare-env.d.ts` (oxlint-ignored)

## Format / imports

- oxfmt + oxlint; tabs (width 2), 80 cols, double quotes, semicolons, trailing commas
- external imports first, then internal; `@tom/*` for shared; `~/*` alias in web; tidy import blocks

## Naming / data flow

- names read like English; descriptive booleans (`isEnabled`, `hasAccess`); no multi-behavior flags
- explicit return types at boundaries; make invalid states hard to represent

## Effect

- `Effect.gen` | `Effect.succeed` | `Effect.fail` | `Effect.try` / `Effect.tryPromise`
- `Effect.catch` for recovery — `catchAll` does not exist in Effect 4
- errors in `@tom/types/errors`; `Redacted.make()` for secrets/tokens; never swallow errors

## Logging (Effect apps)

Standard lives in `@tom/utils/services/logging` (`withLogging`/`LogContext`); worker entries attach context in `onRequest`.

- log via `Effect.log*`; never `console.*` in app code
- every effect run goes through `runEffect`/`runAdapter` with a `LogContext` from `logContextFromRequest(request, "<service>")` — annotations `requestId`, `sessionId` (guestbook token, else visitor `tom_session` cookie), `userId` (signed-in guestbook handle)
- spans via `Effect.fn` (`Service.operation`) / `Effect.withSpan("<service>.<operation>")` — named effects are the span standard
- output: `Logger.consoleStructured` always (Workers Logs); when `OTEL_ENDPOINT` + `AXIOM_TOKEN` are set, spans + logs export to Axiom (traces/logs datasets, default `tom-traces`/`tom-logs`, override with `OTEL_TRACES_DATASET`/`OTEL_LOGS_DATASET`)
- level defaults to Info; `LOG_LEVEL=Debug` for verbose output
- never log secrets or tokens; tokens stay in `Redacted`

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

<!-- effect-solutions:end -->

## Solid (full rules: `apps/web/AGENTS.md`)

- components = setup fns, run once, not render loops
- signals as fns: `count()`; one signal per value
- derivations in `createMemo`/derived fns — never `createEffect` that sets state
- `createEffect(compute, effect)` is two-arg; side effects only; `onCleanup` inside effects
- `onSettled` for mount work (no `onMount`); return cleanup from the callback
- props via `props.x` (no destructure); `merge` for defaults, `omit` for rest
- `<For>`/`<Show>`/`<Switch>`, never `.map()` in JSX; `<Loading>` for async (no `Suspense`, no `createResource`)
- `class` not `className`; template strings for reactive classes (no `classList`); boolean attrs as `"true"`/`"false"` strings

## API

- api: Elysia + Effect, Worker runtime; tsconfig `jsxImportSource: "solid-js"` — preserve

## Infra

- Alchemy deploy order shared → api → adapter → web → editor → sophie; `ALCHEMY_STAGE` required
- production adopts existing `wwwtom`/`apitom` Workers, custom domains, `TOM_RATE_LIMIT_KV`, `guestbook-hyperdrive`
- `TOM_SECRETS` = JSON bundle in account-level Cloudflare Secrets Store; Workers read binding at runtime; no prod secrets in Wrangler config
- per-tenant bundle keys (`TOM_*`/`SOPHIE_*`) resolve under shared names with shared-value fallback; explicit worker env wins over the bundle; Sophie allowlist + Google keys are fail-closed
- `CMS_AUTH_PROVIDERS` enforces github-only (Tom) / google-only (Sophie) per API worker
- Sophie binds no Hyperdrive (CMS is D1+R2; nothing reads `databaseUrl`)
- web deploys via `Cloudflare.Website.Vite` (`nodejs_compat`); no web Wrangler config; don't reintroduce Vinxi

## Rule files

- no `.cursor/` rules, `.cursorrules`, `.github/copilot-instructions.md`, or `CLAUDE.md`

## Commits

- conventional commits: `feat|fix|chore|refactor(scope):`; breaking = `BREAKING CHANGE:` body or `!`; PR titles same format

## Sites

- web `https://tom.so`, api `https://api.tom.so`
- sophie `https://sophie.st`, sophie api `https://api.sophie.st`
- if unsure, read nearest package or app config before changing patterns
