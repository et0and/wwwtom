import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount } from "solid-js";
import { Meta, MetaProvider } from "@solidjs/meta";
import { getAdapterBaseUrl } from "~/libs/adapter";
import { QueryClientProvider } from "@tanstack/solid-query";
import { Footer } from "@tom/ui/Footer";
import { Nav } from "@tom/ui/Nav";
import { ProgressBar } from "@tom/ui/ProgressBar";
import { SkipLink } from "@tom/ui/SkipLink";
import { queryClient } from "~/libs/query-client";
import { useGlobalHaptics } from "~/libs/haptics";
import "./app.css";

function RootLayout(props: { children?: import("solid-js").JSX.Element }) {
  onMount(() => {
    useGlobalHaptics();
  });

  return (
    <div class="min-h-screen flex flex-col">
      <SkipLink />
      <ProgressBar />
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
    <QueryClientProvider client={queryClient}>
      <MetaProvider>
        {import.meta.env.SSR && <Meta name="x-adapter-url" content={getAdapterBaseUrl()} />}
        <Router root={RootLayout}>
          <FileRoutes />
        </Router>
      </MetaProvider>
    </QueryClientProvider>
  );
}
