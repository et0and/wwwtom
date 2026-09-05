import { Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

/**
 * HttpClient bound to the current global fetch. Built per call because the
 * Fetch reference default pins the first-seen implementation process-wide.
 */
export const liveHttpClient = (): Layer.Layer<HttpClient.HttpClient> =>
  Layer.provideMerge(FetchHttpClient.layer, Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch));
