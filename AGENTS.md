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

## Commits & PRs
- Use conventional commits for commit messages and PR titles (e.g., `feat:`, `fix:`, `chore:`).

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
- Throw descriptive errors with context
- Use proper TypeScript interfaces for API responses
- Server functions marked with `"use server"`
