# yufu

Client-rendered Effect UI SPA (Elm architecture on Effect). Reference:
`https://ui.effect.website` and the source of that page in
`Effect-TS/ui/examples/launch`.

## Project Notes

- `@tom/yufu` runs on port 3002.
- `src/main.ts` holds the single Component: its Schema, update and view.
- `src/entry.ts` mounts it on the browser host with the DevTools layer.
- Tests live in `src/__tests__` and drive `HtmlScene` with `it.effect`.
- Styling is StyleX (`src/styles.stylex.ts`); both Vite and Vitest load
  `stylex.vite(stylexOptions)` from `@tom/ui/stylex.config`.
- `src/routes.ts` owns the typed routes: home, manga index, manga reader and
  a catch-all. `src/entry.ts` mounts with `BrowserRouter.layerHash` because the
  site is static hosting.
- The manga reader signs in with GitHub through the adapter `/auth` proxy.
  `src/auth/session.ts` reads the session; `src/auth/sign-in.ts` starts OAuth.
- Private CBR/CBZ archives come from the adapter's `/manga/*` routes. CBZ is
  decoded with `fflate`; CBR uses `node-unrar-js` and a bundled WASM file.
- `@effect/ui`, `@effect/ui-kit` and `@effect/ui-devtools` are pinned to one
  snapshot build of Effect UI, which is in public preview and not on npm yet.
  The snapshot requires Effect 4.1.4, so this app declares that version
  directly; the rest of the monorepo stays on the 4.1.2 catalog entry that
  Alchemy needs. Update all three URLs together when re-pinning.
