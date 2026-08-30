// @refresh reload
import { hydrate } from "@solidjs/web";
import App from "./app";
import { Document } from "./Document";

// TanStack Query v6 serializes its cache through the provider's own
// hydration channel during SSR; the client replay restores the queries, so
// no manual dehydrated-state script is needed here.
hydrate(
  () => (
    <Document>
      <App />
    </Document>
  ),
  document,
);
