import { Router } from "@effect/ui";
import { DevTools } from "@effect/ui-devtools";
import { BrowserHost, BrowserRouter } from "@effect/ui/html";
import { Effect, Layer } from "effect";

import { App } from "./App";
import { SessionLayer } from "./auth/session";
import { MangaManifestLayer } from "./manga/manifest";
import { AppRoute } from "./routes";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Yufu: #root element is missing");
}

const Main = BrowserHost.mount(App, Router.props(AppRoute), root).pipe(
  Layer.provide([
    BrowserRouter.layerHash({ routes: AppRoute }),
    SessionLayer,
    MangaManifestLayer,
    DevTools.layer({ position: "BottomRight" }),
  ]),
);

Layer.launch(Main).pipe(Effect.runFork);
