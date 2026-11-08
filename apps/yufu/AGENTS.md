# yufu

Client-rendered Foldkit SPA. The framework conventions and the vendored
source map live in the repository-root [`FOLDKIT.md`](../../FOLDKIT.md);
read it before changing this app.

## Project Notes

- `@tom/yufu` runs on port 3002.
- `src/entry.ts` boots the runtime; `src/main.ts` holds the pure Model,
  Message, update, init, and view definitions.
- Tests live in `src/__tests__` and drive `foldkit/scene`.
- To re-pin the vendored source after a Foldkit upgrade, run the subtree
  pull from the repository root and read the installed version from this
  app: `node -p "require('./apps/yufu/node_modules/foldkit/package.json').version"`.
