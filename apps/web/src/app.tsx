import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount } from "solid-js";
import { MetaProvider } from "@solidjs/meta";
import { SkipLink, Nav, Footer } from "~/components";
import { useGlobalHaptics } from "~/libs/haptics";
import "./app.css";

export default function App() {
  return (
    <MetaProvider>
      <Router
        root={(props) => {
          onMount(() => {
            useGlobalHaptics();
          });

          return (
            <div class="min-h-screen flex flex-col">
              <SkipLink />
              <Nav />
              <div class="flex-1">
                <Suspense>{props.children}</Suspense>
              </div>
              <Footer />
            </div>
          );
        }}
      >
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
