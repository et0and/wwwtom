// @refresh reload
import { renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import { App } from "./App";
import { Document } from "./Document";

/**
 * Custom server entry (start mode). The query cache is created fresh per
 * request by the middleware (locals.queryClient), so parallel SSR renders
 * never share cache state.
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
