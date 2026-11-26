# web-effectui

Spike for rewriting `apps/web` with Effect UI. It proves three things before
any Solid code is removed:

- typed routes with `Route.union` and `Router`,
- server rendering through `HtmlServer.renderToHtml` in a Worker `fetch`
  handler, with query results serialized into the document state,
- browser hydration through `HtmlHydrate.hydrateEffect` adopting that state.

`@effect/ui` is pinned to one snapshot build. Effect comes from the monorepo
catalog, which Alchemy also uses.

The spike has its own host and client bundle. It does not replace the Solid
routes on tom.so yet. See `src/README.md` for the findings and the decision
it supports.
