import { Router } from "@effect/ui";
import { BrowserRouter, HtmlHydrate } from "@effect/ui/html";
import { Effect } from "effect";

import { App } from "./App";
import { PostsLayer } from "./Posts";
import { AppRoute } from "./routes";

const hydrate = Effect.gen(function* () {
  const state = JSON.parse(document.getElementById("state")?.textContent ?? "{}");
  const root = yield* HtmlHydrate.hydrateEffect(
    App,
    Router.props(AppRoute),
    document.getElementById("app")!,
    state,
  );
  yield* root.adopted;
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide([BrowserRouter.layer({ routes: AppRoute }), PostsLayer]));

Effect.runFork(hydrate);
