import { Router, type RouteSectionProps } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount } from "solid-js";
import { MetaProvider } from "@solidjs/meta";
import { SkipLink, Nav, Footer } from "~/components";
import { useGlobalHaptics } from "~/libs/haptics";
import "./app.css";

function RootLayout(props: RouteSectionProps) {
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
}

export default function App() {
  return (
    <MetaProvider>
      <Router root={RootLayout}>
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
