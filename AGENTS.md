# Agent Guidelines

## General Principles

- Keep things in one function unless composable or reusable
- AVOID unnecessary destructuring of variables
- AVOID `else` statements unless necessary
- AVOID `try`/`catch` - use Effect for error handling
- AVOID using `any` type
- AVOID `let` statements - prefer `const`
- PREFER single word variable names where possible
- AVOID Node-specific APIs - this runs on Cloudflare Workers

## Project Structure

This is a Bun + Turborepo monorepo with:

- `apps/web` - SolidStart web app (Vinxi, deployed to Cloudflare Workers)
- `apps/cms` - Payload CMS for content management
- `apps/api` - API endpoints
- `packages/@tom/*` - Shared packages (arena, db, payload, types, ui, utils)

Production domain: https://tom.so

## Development Commands

### Build & Development

- `bun dev` - Start dev server (via Turbo)
- `bun dev:web` - Start only web app dev server
- `bun dev:api` - Start only API dev server
- `bun build` - Build for production
- `bun deploy` - Build and deploy to Cloudflare
- `bun deploy:api` - Deploy API only

### Code Quality

- `bun lint` - Run oxlint linter
- `bun format` - Check formatting with oxfmt
- `bun write` - Auto-format with oxfmt
- `bun typecheck` - Run TypeScript type checking

### Testing

- `bun test` - Run all tests via Turbo
- `bun test -- Nav.test.tsx` - Run single test file (from repo root, filters to file)
- `bun test:ui` - Run tests with UI
- `bun test:coverage` - Run tests with coverage

Test files live in `__tests__/*.test.tsx` directories alongside source. To run specific tests from within apps/web, use `npx vitest run Nav.test.tsx`.

## TypeScript Configuration

- Target: ESNext with bundler module resolution
- Strict mode enabled with additional checks:
  - `exactOptionalPropertyTypes`
  - `noImplicitReturns`
  - `noFallthroughCasesInSwitch`
  - `noUncheckedIndexedAccess`
- Effect language service plugin enabled

## Formatting Rules

- Use tabs (2 spaces width)
- 80 character line limit
- Trailing commas always
- Double quotes, semicolons required

## Import Conventions

- Use `~/` path alias for src imports: `import { api } from "~/libs/api"`
- Import order: external libraries first, then internal modules
- Use workspace packages: `import { logger } from "@tom/utils"`

## SolidJS Rules

### Mental Model

- Components are setup functions that run ONCE, not render functions
- Place reactive work in primitives (`createMemo`, `createEffect`, `<Show>`, `<For>`)
- Access signals only inside reactive contexts (JSX, effects, memos)

### Reactivity

- Call signals as functions: `count()` not `count`
- Use functional updates: `setCount((prev) => prev + 1)`
- Use `createMemo` for expensive/frequent derivations
- Use `createEffect` for side effects only
- Call `onCleanup` inside effects for cleanup
- NEVER derive state via `createEffect(() => setX(y()))` - use memo

### Props

- Access props via `props.title`, NEVER destructure `({ title })`
- Use `splitProps` to separate local from pass-through props
- Use `mergeProps` for default values

### Control Flow

- Use `<For each={items()}>` for object arrays
- Use `<Index each={items()}>` for primitives
- Use `<Show when={cond()} fallback={...}>` for conditionals
- Use `<Suspense>` for async, not `<Show when={!loading}>`
- NEVER use `.map()` in JSX - use `<For>` or `<Index>`

### JSX & DOM

- Use `class` not `className`
- Use `classList={{ active: isActive() }}` for reactive classes
- Use `onClick` for delegated events, `on:click` for native
- Read refs in `onMount` or effects - refs connect after render

## Error Handling with Effect

This project uses Effect for error handling and control flow.

### Server Actions Pattern

```typescript
import { Effect } from "effect";
import { runServerEffect } from "@tom/utils";

export const getData = query(async () => {
  "use server";
  return await runServerEffect(
    Effect.gen(function* () {
      const result = yield* someEffect();
      return result;
    })
  );
}, "cache-key");
```

### Custom Errors

Define errors in `@tom/types`:

```typescript
import { MissingFieldError, AuthenticationError } from "@tom/types";
yield * Effect.fail(new MissingFieldError({ field: "name" }));
```

### Logging

Use the Effect-based logger from `@tom/utils`:

```typescript
import { logger } from "@tom/utils";
logger.info("message");
logger.error("error message");
```

## Testing Patterns

Use Vitest with @solidjs/testing-library:

```typescript
import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { Router, Route } from "@solidjs/router";

describe("Component", () => {
  it("renders correctly", () => {
    const { container } = render(() => (
      <Router>
        <Route path="/" component={MyComponent} />
      </Router>
    ));
    expect(container).toMatchSnapshot();
  });

  it("has correct navigation links", () => {
    render(() => (
      <Router>
        <Route path="/" component={Nav} />
      </Router>
    ));
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });
});
```

Test setup file `src/test/setup.ts` includes jest-dom matchers and `window.matchMedia` mock.

## Server Functions

Mark server-only code with `"use server"` directive:

```typescript
export function getClient(): Effect.Effect<Client, ConfigError> {
  "use server";
  return Effect.gen(function* () {
    // server-only logic
  });
}
```

## Commits & PRs

Use scoped conventional commits:

- `feat(components):` - New feature
- `fix(sources):` - Bug fix
- `chore:` - Maintenance tasks
- `refactor(ui):` - Code refactoring

## Effect Reference

The Effect repository is available at `/effect` in this repo for API reference. Key packages:

- `effect` - Core library
- `@effect/platform` - Platform-agnostic utilities
- `@effect/cli` - CLI utilities

Use `Effect.gen`, `Effect.succeed`, `Effect.fail`, `Effect.try` for operations.
Use `Redacted.make()` for sensitive values like tokens.

## Workspace Packages

- `@tom/types` - Shared TypeScript types and custom error definitions
- `@tom/utils` - Shared utilities including logger and Effect helpers
- `@tom/ui` - Shared SolidJS UI components (Nav, Link, Spinner, Footer, etc.)
- `@tom/db` - Database utilities and schemas
- `@tom/arena` - Arena API integration
- `@tom/payload` - Payload CMS integration helpers

## Environment

- Runtime: Cloudflare Workers (not Node.js)
- Database: PostgreSQL
- CMS: Payload CMS
- Deployment: Cloudflare Workers for web and API, Fly.io for CMS
