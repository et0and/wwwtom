import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Effect } from "effect";

import { App } from "./App";
import { PostsLayer } from "./Posts";
import { AppRoute } from "./routes";

type Rendered = {
  readonly html: string;
  readonly state: Parameters<typeof HtmlServer.serializeState>[0];
  readonly head: string;
  readonly htmlAttributes: string;
  readonly bodyAttributes: string;
};

const document = (page: Rendered): string =>
  `<!doctype html>
<html ${page.htmlAttributes}>
  <head><meta charset="utf-8">${page.head}</head>
  <body ${page.bodyAttributes}>
    <div id="app">${page.html}</div>
    <script type="application/json" id="state">${HtmlServer.serializeState(page.state)}</script>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`;

/** Worker entry: one render per request, with the query cache in the state. */
export const fetch = (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  return Effect.runPromise(
    Effect.gen(function* () {
      const page = yield* HtmlServer.renderToHtml(App, Router.props(AppRoute));
      return new Response(document(page), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }).pipe(
      Effect.provide([
        Router.static({ routes: AppRoute, url: url.pathname + url.search }),
        PostsLayer,
      ]),
    ),
  );
};
