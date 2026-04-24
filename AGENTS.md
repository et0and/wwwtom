# wwwtom Agent Instructions

## Purpose

- This repo is a Bun + Turborepo monorepo for tom.so, api.tom.so, cms.tom.so and sophie.st.
- Make the smallest correct change, follow local patterns, and verify before
  handoff.
- Prefer improving existing code over introducing new abstractions.

## Repo Shape

- `apps/web` — SolidStart app on Cloudflare Workers.
- `apps/api` — Hono API on Cloudflare Workers.
- `apps/cms` — Payload CMS on Next.js with Open Next.
- `apps/(stores)` — Ecommerce stores running on Medusa.js (in progress).
- `packages/@tom/*` — shared packages like `ui`, `utils`, `types`, `db`,
  `arena`, `payload`, `schemas`, `checkout`, `constants`, `haptics`, and
  other `@tom/*` workspaces present in the repo.

## General Working Rules

- Keep things in one function unless composable or reusable
- AVOID unnecessary destructuring of variables
- AVOID `else` statements unless necessary
- AVOID `try`/`catch` - use Effect for error handling
- AVOID using `any` type
- AVOID `let` statements - prefer `const`
- PREFER clear, descriptive variable names where possible
- AVOID Node-specific APIs - this runs on Cloudflare Workers
- Improve existing files instead of rewriting patterns arbitrarily.

## Runtime and Platform Constraints

- All code run on Cloudflare Workers.
- Avoid Node-only APIs unless the runtime boundary
  already requires them.
- Treat `packages/@tom/*` as portable across apps.
- `apps/web` uses Wrangler with `nodejs_compat`, but still prefer web-standard
  and Worker-safe APIs.

## Core Commands

### Root

- `bun dev` — run all dev tasks through Turbo.
- `bun dev:web` — run only `@tom/web`.
- `bun dev:api` — run only `@tom/api`.
- `bun build` — Turbo build.
- `bun lint` — Turbo lint.
- `bun format` — `oxfmt --check .`.
- `bun write` — `oxfmt --write .`.
- `bun typecheck` — Turbo typecheck.
- `bun test` — run tests via Turbo.
- `bun test:update` — update snapshots in web and utils.
- `bun deploy` / `bun deploy:api` — deploy web or api.

### App / Package Commands

- `apps/web`: `bun run dev|build|typecheck|lint|test|test:ui|test:coverage`
- `apps/api`: `bun run dev|build|deploy|cf-typegen`
- `apps/cms`: `bun run dev|build|lint|lint:fix|generate:types|preview`
- `apps/docs`: `bun run dev|build|preview`
- `packages/@tom/utils`: `bun run test|typecheck`

## Single-Test Commands

- Root filename filter: `bun test -- Nav.test.tsx`
- Web exact file: `cd apps/web && npx vitest run Nav.test.tsx`
- Web exact path:
  `cd apps/web && npx vitest run src/components/__tests__/Nav.test.tsx`
- Utils exact file:
  `cd packages/@tom/utils && bun vitest run __tests__/telegram.test.ts`
- CMS integration file:
  `cd apps/cms && bun vitest run tests/int/<name>.int.spec.ts`

## Test Locations and Setup

- Web tests live in `apps/web/src/**/__tests__/*.test.tsx`.
- Utils tests live in `packages/@tom/utils/__tests__/*`.
- CMS tests live in `apps/cms/tests/int/**/*.int.spec.ts`.
- Web Vitest uses `jsdom`, globals, and `apps/web/src/test/setup.ts`.
- Web test setup includes `@testing-library/jest-dom`, cleanup, and a
  `window.matchMedia` mock.

## TypeScript Rules

- Use strict TypeScript.
- Important enforced options: `exactOptionalPropertyTypes`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`.
- Module resolution is bundler-style.
- The Effect language service plugin is enabled.
- Parse unknown input at boundaries; keep internal types trusted.

## Formatting and Imports

- Formatter/lint baseline comes from `oxfmt` and `oxlint`.
- Use tabs with width 2, target 80 columns, double quotes, semicolons, and
  trailing commas.
- Order imports with external packages first, then internal modules.
- Use workspace imports for shared code: `@tom/*`.
- In `apps/web`, use the `~/*` alias for app-local imports.
- Keep import blocks tidy; do not scatter equivalent imports.

## Naming and Data Flow

- Name functions and variables so the code reads like English.
- Prefer descriptive booleans like `isEnabled` and `hasAccess`.
- Avoid boolean flags that hide multiple behaviors inside one function.
- Prefer explicit return types when they improve boundary readability.
- Make invalid states hard to represent.

## Error Handling and Effects

- Prefer `Effect.gen`, `Effect.succeed`, `Effect.fail`, and `Effect.try`.
- Define shared/custom errors in `@tom/types`.
- Follow the logging API already used in the touched area; for example, CMS code
  uses `payload.logger`.
- Use `Redacted.make()` for secrets and tokens.
- Do not swallow errors.

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

<!-- effect-solutions:end -->

## Repo Rule Files

- No `.cursor/` rules directory was found.
- No `.cursorrules` file was found.
- No `.github/copilot-instructions.md` file was found.
- No `CLAUDE.md` file was found.

## Solid / SolidStart Rules

- Components are setup functions, not render loops.
- Access signals as functions: `count()`.
- Put derivations in `createMemo`, not effects that set state.
- Use `createEffect` only for side effects.
- Call `onCleanup` inside effects when needed.
- Access props via `props.x`; do not destructure component props.
- Use `splitProps` for local vs passthrough props and `mergeProps` for
  defaults.
- Use `<For>`, `<Index>`, and `<Show>` instead of `.map()` in JSX.
- Use `<Suspense>` for async UI.
- Use `class`, not `className`; use `classList` for reactive classes.

## API / CMS Notes

- API code uses Hono and Worker runtime constraints.
- `apps/api` uses `jsxImportSource: "hono/jsx"`; preserve that pattern.
- CMS uses Next.js + Payload + React; do not force Solid patterns into CMS.
- CMS has its own `eslint.config.mjs`; follow stronger local app rules when
  they differ.

## Testing Conventions

- Prefer Vitest across the repo.
- For Solid UI tests, use `@solidjs/testing-library`.
- Wrap router-dependent components in `Router` / `Route` as needed.
- Assert user-visible behavior first.
- Keep snapshots focused.
- Run the narrowest relevant test first, then broader verification if needed.

## Verification Expectations

- Minimum: run targeted tests for changed code when tests exist.
- For broader changes, also run relevant lint and typecheck commands.
- Good defaults: `bun lint`, `bun typecheck`, and `bun test -- <file>` or a
  package-local Vitest command.
- If something cannot be verified locally, say so explicitly.

## Commits and PR Titles

- Use conventional commits because releases depend on them.
- Valid prefixes: `feat(scope):`, `fix(scope):`, `chore(scope):`,
  `refactor(scope):`.
- Use `BREAKING CHANGE:` in the body, or `!`, for breaking changes.
- PR titles should follow the same format.

## Quick Reference

- Production site: `https://tom.so` for web, `https://api.tom.so` for api, and `https://cms.tom.so` for cms.
- Web deploy target: Cloudflare Workers.
- API deploy target: Cloudflare Workers.
- CMS deploy flow uses OpenNext + Cloudflare plus database migrations on Cloudflare Workers.
- If unsure, read the nearest package or app config before changing patterns.
