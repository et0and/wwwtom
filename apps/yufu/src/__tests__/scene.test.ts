import { HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { Effect } from "effect";
import { test } from "vitest";

import { Home } from "../main";

test("renders the app heading", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const scene = yield* HtmlScene.make(Home, {});
      scene.expect(Locator.text("ABOUT YUFU")).toExist();
    }).pipe(Effect.scoped),
  );
});
