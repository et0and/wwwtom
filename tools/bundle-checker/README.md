# Bundle checker

A small OCaml CLI that checks the client-side JavaScript and CSS emitted by
Vite. It runs in a pinned OCaml container, so the host does not need an OCaml
installation.

## Run it

From the repository root:

```sh
pnpm check:bundles
```

The root command builds the Vite applications, builds the editor with the
production Sophie flags (`VITE_SOPHIE=true` and Google auth), builds the
checker image, and mounts the repository read-only in the container. Docker
must be running.

To check an existing build without rebuilding the applications:

```sh
bash scripts/check-bundles.sh
```

The checker reads `tools/bundle-checker/budgets.json`, scans each configured
assets directory, measures emitted file bytes, and exits with status `1` when a
budget is exceeded. Source maps and non-JavaScript/CSS files are ignored.

## Configuration

Each app has an assets directory and optional byte budgets:

- `maxTotalJavaScriptBytes`
- `maxTotalCssBytes`
- `maxAssetBytes`

Paths are relative to the repository root. Keep budgets above current sizes
with a small, deliberate headroom; update them when an intentional bundle
change is made.

## Updating the container

`Dockerfile` pins the multi-architecture `ocaml/opam` build image and the
`debian:bookworm-slim` runtime image by manifest digest. When updating either
image, choose a new tag, resolve its manifest digest, and replace the `FROM`
value. The checker is built into the image, so the pinned images keep the
OCaml toolchain and runtime together in CI.
