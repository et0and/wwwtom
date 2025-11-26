# IMPORTANT

- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- DO NOT use `else` statements unless necessary
- DO NOT use `try`/`catch` if it can be avoided
- AVOID `try`/`catch` where possible
- AVOID `else` statements
- AVOID using `any` type
- AVOID `let` statements
- PREFER single word variable names where possible
- Use as many Bun APIs as possible like Bun.file()
- AVOID using Node specific APIs where possible as we run on Cloudflare Workers

# Development Commands

## Build & Development
- `bun dev` - Start development server
- `bun build` - Build for production
- `bun start` - Start production server

## Code Quality
- `bun lint` - Run oxlint linter
- `bun format` - Check code formatting with Prettier
- `bun write` - Format code with Prettier

## Testing
- `bun test` - Run all tests
- `bun test:ui` - Run tests with UI
- `bun test:coverage` - Run tests with coverage
- Run single test: `bun test -- Nav.test.tsx`

# Code Style Guidelines

## Runtime
- This project runs on Cloudflare Workers.
- Production domain for this project is https://tom.so

## Logging
- This project uses Effect's logging utilities using a logger wrapper called [logger.ts](src/libs/utils/logger.ts). For context/reference, refer to the Effect git subtree in this repository.

## Commits & PRs
- Use scoped conventional commits for commit messages and PR titles (e.g., `feat(components):`, `fix(sources):`, `chore:`).

## TypeScript & SolidJS
- Use SolidJS patterns: signals, createSignal, Show, For
- Import SolidJS components: `import { createSignal } from "solid-js"`
- Use `class` attribute (not `className`)
- JSX preserve mode with solid-js import source

## Imports & Aliases
- Use `~/` prefix for src imports: `import { api } from "~/lib/api"`
- Group imports: external libraries first, then internal modules

## Formatting
- Use tabs (2 spaces width)
- 80 character line limit
- Trailing commas always
- Double quotes, semicolons required

## Testing
- Use Vitest with @solidjs/testing-library
- Test files: `__tests__/*.test.tsx`
- Snapshot testing for components
- Global test setup in `src/test/setup.ts`

## Error Handling
- Use Effect for error handling and control flow where possible. Refer to the Effect git subtree in this repository for context (/effect)
- Throw descriptive errors with context
- Use proper TypeScript interfaces for API responses
- Server functions marked with `"use server"`

<!-- effect-solutions:start -->
## Effect Solutions Usage

This project uses Effect TypeScript for error handling, logging, and control flow. Key patterns:

- **Effect & Data**: Use `Effect.succeed`, `Effect.fail`, `Effect.try` for data operations
- **Services & Context**: Use `Effect.service` for dependency injection
- **Error Handling**: Prefer Effect's error handling over try/catch
- **Logging**: Use the logger wrapper at `src/libs/utils/logger.ts`
- **Async Operations**: Use Effect patterns for async/await replacement

**Local Effect Source:** The Effect repository is cloned to `~/.local/share/effect-solutions/effect` for reference. Use this to explore APIs, find usage examples, and understand implementation details when the documentation isn't enough.
<!-- effect-solutions:end -->
