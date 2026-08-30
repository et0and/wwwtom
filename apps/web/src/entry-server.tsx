// @refresh reload
import { renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import App from "./app";
import { Document } from "./Document";

/**
 * Custom server entry (start mode). `render` returns a renderToStream
 * result; the generated handler wraps it in the response-head lifecycle
 * (createSSRResponse) and rewrites the `/src/entry-client.tsx` reference to
 * the hashed client asset in production. The client hydrates the same
 * <Document> tree, so hydration keys stay in lockstep.
 *
 * The query cache is created fresh per request by the middleware
 * (locals.queryClient), so parallel SSR renders never share cache state.
 */
export function render() {
  return renderToStream(
    () => (
      <Document>
        <App />
      </Document>
    ),
    { manifest },
  );
}
