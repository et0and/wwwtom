# web-effectui spike: findings

The spike renders `/about` and `/posts` with Effect UI. It does not change
tom.so. Three tests in `src/__tests__/spike.test.ts` prove the path.

## Proven

- `Route.union` gives typed routes for `/about`, `/posts` and a `/*` catch-all.
  The root holds the route in its Model and gets later ones from
  `Router.subscription`.
- `HtmlServer.renderToHtml` runs in a plain Worker `fetch` handler. `Router.static`
  supplies the route, and the returned state is serialized into `#state`.
- A `Query.Service` result is fetched during the server render and shipped in
  the state. `ssr` confirms the browser adopts the server tree and state.
- Vite builds the hydration entry as a client bundle.

## Gotchas found

- Router URLs are path plus search, not absolute URLs. `Router.static` with
  `request.url` resolves to the catch-all; use `url.pathname + url.search`.
- The `ssr` test helper needs `TestClock.layer()` as well as `TestHost.layer()`.
- A failed `AsyncResult` holds a `Cause`, not an `.error` field.
- `Effect.provide` takes one merged Layer here, not an array of Layers.

## Before the web rewrite

- Wire the SSR handler into Alchemy's `Cloudflare.Website.Vite` and serve the
  client bundle. `main` supports a custom Worker entry, but Solid's generated
  entry must still be wrapped if both frameworks share one Worker.
- Replace the fixture `Posts` query with an adapter-backed query.
- Port the Solid chrome from `@tom/ui` (Nav, Footer, SkipLink, PageLayout,
  ViewTransitions, color mode) to Effect UI components.
- Convert web's 20 testing-library tests to Story, Scene and Play tests.
- Keep using core Effect with vitest 4 for tests. `@effect/vitest@4.1.4`
  requires vitest 5, which this repo does not use.
