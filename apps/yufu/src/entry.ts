import { DevTools } from "@effect/ui-devtools";
import { BrowserHost } from "@effect/ui/html";
import { Effect, Layer } from "effect";

import { YufuPage } from "./main";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Yufu: #root element is missing");
}

const Main = BrowserHost.mount(YufuPage, {}, root).pipe(
  Layer.provide(DevTools.layer({ position: "BottomRight" })),
);

Layer.launch(Main).pipe(Effect.runFork);
