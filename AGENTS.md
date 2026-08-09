# wwwtom

pnpm + Turborepo monorepo: tom.so, api.tom.so, cms.tom.so, sophie.st.
Smallest correct change, follow local patterns, verify before handoff.
Improve existing code; avoid new abstractions.

## Shape

- `apps/web` — SolidStart 2 (2.0.0-beta.9) + Vite, Workers. Solid rules: `apps/web/AGENTS.md`.
- `apps/api` — Elysia (`CloudflareAdapter`) + Effect, Workers.
- `apps/cms` — Payload 3.75 + Next 16 + OpenNext, Workers (D1 SQLite, R2).
- `apps/sophie` — Payload site, Next + OpenNext, Workers.
- `apps/adapter` — fediverse adapter, Elysia + Effect, Workers.
- `apps/simulator` — dev-only Elysia/Effect tooling (tsx).
- `packages/@tom/*` — ui, utils, types, db, arena, payload, schemas, checkout, constants, haptics, email.
- `infra` — Alchemy 2.0.0-beta.63 + Effect 4.0.0-beta.99 stacks: shared, api, adapter, web.

## Working rules

- one function unless composable/reusable
- no unnecessary destructuring; no `else` unless needed; no `try`/`catch` — use Effect
- no `any`; no `let` — prefer `const`; descriptive names
- no Node-only APIs — Workers runtime; prefer web-standard/Worker-safe
- improve existing files, don't rewrite patterns

## Commands (root)

- `pnpm dev` (all via Turbo) | `dev:web` | `dev:api` | `dev:adapter` | `dev:cms` | `dev:sophie`
- `pnpm build` | `lint` | `typecheck` | `test` (Turbo)
- `pnpm format` = `oxfmt --check .`; `pnpm write` = `oxfmt --write .`
- `pnpm test:update` — snapshot update (web, utils)
- `pnpm deploy` = shared → api → adapter → web (Alchemy; `ALCHEMY_STAGE` required)
- `pnpm deploy:shared|deploy:api|deploy:adapter|deploy:web`
- `pnpm deploy:cms` / `deploy:sophie` (OpenNext; `CLOUDFLARE_ENV` required)
- `pnpm destroy` — destroy current Alchemy stage

## App scripts

- web: `dev|build|start|typecheck|lint|test|test:ui|test:coverage`
- api: `dev|build|deploy|test|typecheck|lint|cf-typegen`
- cms: `dev|build|lint|lint:fix|generate:types|generate:importmap|payload|preview|deploy|deploy:app|deploy:database`
- sophie: + `typecheck`

## Single tests

- root filter: `pnpm test -- Nav.test.tsx`
- web: `cd apps/web && npx vitest run Nav.test.tsx` (or `src/components/__tests__/Nav.test.tsx`)
- utils: `cd packages/@tom/utils && pnpm vitest run __tests__/telegram.test.ts`
- cms: `cd apps/cms && pnpm vitest run tests/int/<name>.int.spec.ts`

## Tests

- web: `apps/web/src/**/__tests__/*.test.tsx`; jsdom, globals, `src/test/setup.ts` (jest-dom, cleanup, matchMedia mock)
- utils: `packages/@tom/utils/__tests__/*`
- cms: `apps/cms/tests/int/**/*.int.spec.ts` (vitest + jsdom)
- Solid UI: `@solidjs/testing-library`; wrap router deps in `Router`/`Route`; assert user-visible behavior; focused snapshots; narrowest relevant test first

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
- errors in `@tom/types/errors`; `Redacted.make()` for secrets/tokens; never swallow errors
- match logging API in touched area (CMS: `payload.logger`)

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
- `createEffect` side effects only; `onCleanup` inside effects
- props via `props.x` (no destructure); `splitProps`/`mergeProps`
- `<For>`/`<Index>`/`<Show>`, never `.map()` in JSX; `<Suspense>` for async
- `class` not `className`; `classList` for reactive classes

## API / CMS

- api: Elysia + Effect, Worker runtime; tsconfig `jsxImportSource: "solid-js"` — preserve
- cms/sophie: Next + Payload + React; don't force Solid patterns into CMS
- cms has own `eslint.config.mjs`; follow stronger local app rules when they differ

## Infra

- Alchemy deploy order shared → api → adapter → web; `ALCHEMY_STAGE` required
- production adopts existing `wwwtom`/`apitom` Workers, custom domains, `TOM_RATE_LIMIT_KV`, `guestbook-hyperdrive`
- `TOM_SECRETS` = JSON bundle in account-level Cloudflare Secrets Store; Workers read binding at runtime; no prod secrets in Wrangler config
- web deploys via `Cloudflare.Website.Vite` (`nodejs_compat`); no web Wrangler config; don't reintroduce Vinxi

## Rule files

- no `.cursor/` rules, `.cursorrules`, `.github/copilot-instructions.md`, or `CLAUDE.md`

## Commits

- conventional commits: `feat|fix|chore|refactor(scope):`; breaking = `BREAKING CHANGE:` body or `!`; PR titles same format

## Sites

- web `https://tom.so`, api `https://api.tom.so`, cms `https://cms.tom.so`
- if unsure, read nearest package or app config before changing patterns
