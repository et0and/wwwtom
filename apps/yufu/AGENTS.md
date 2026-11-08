# yufu

Client-rendered Foldkit SPA. The framework conventions and the vendored
source map live in the repository-root [`FOLDKIT.md`](../../FOLDKIT.md);
read it before changing this app.

## Project Notes

- `@tom/yufu` runs on port 3002.
- `src/entry.ts` boots the runtime; `src/main.ts` holds the pure Model,
  Message, update, init, and view definitions.
- Tests live in `src/__tests__` and drive `foldkit/scene`.
- Styling is StyleX (`src/styles.stylex.ts`); both Vite and Vitest load
  `stylex.vite(stylexOptions)` from `@tom/ui/stylex.config`.
- The DevTools MCP server is not wired into this monorepo. Run
  `npx @foldkit/devtools-mcp init` when you need live Model inspection.
- `repos/foldkit` is a git submodule, not a subtree. `FOLDKIT.md` is the
  upstream template, so its subtree commands are superseded. Initialize it
  after a clone with `git submodule update --init repos/foldkit`. Re-pin the
  submodule from the repository root:

  ```sh
  git -C repos/foldkit fetch --tags
  git -C repos/foldkit checkout "foldkit@$(node -p "require('./apps/yufu/node_modules/foldkit/package.json').version")"
  git add repos/foldkit
  ```
