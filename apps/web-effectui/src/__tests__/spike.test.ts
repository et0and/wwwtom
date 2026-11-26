// @vitest-environment jsdom
import { Router } from "@effect/ui";
import { ssr } from "@effect/ui/html/testing";
import { TestHost } from "@effect/ui/testing";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { App } from "../App";
import { PostsLayer } from "../Posts";
import { AppRoute } from "../routes";
import { fetch as workerFetch } from "../worker";

const layers = (url: string) =>
  Layer.mergeAll(
    Router.memory({ routes: AppRoute, url }),
    TestHost.layer(),
    TestClock.layer(),
    PostsLayer,
  );

const render = (url: string) =>
  ssr(App, Router.props(AppRoute)).pipe(Effect.provide(layers(url)), Effect.scoped);

describe("Effect UI web spike", () => {
  it("renders /about on the server and hydrates it", async () => {
    const result = await Effect.runPromise(render("/about"));
    expect(result.html).toContain("This page is rendered by Effect UI");
    expect(result.adopted.length).toBeGreaterThan(0);
  });

  it("renders /posts with a query result in the server state", async () => {
    const result = await Effect.runPromise(render("/posts"));
    expect(result.html).toContain("Hello");
    expect(result.html).toContain("Second");
  });

  it("serves /posts HTML from the Worker fetch handler", async () => {
    const response = await workerFetch(new Request("https://example.com/posts"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Hello");
    expect(html).toContain('id="state"');
  });
});
