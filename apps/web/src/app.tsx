import { QueryClientProvider } from "@tanstack/solid-query";
import { onSettled } from "solid-js";
import { Footer } from "@tom/ui/Footer";
import { Nav } from "@tom/ui/Nav";
import { ProgressBar } from "@tom/ui/ProgressBar";
import { SkipLink } from "@tom/ui/SkipLink";
import { useGlobalHaptics } from "~/libs/haptics";
import { getQueryClient } from "~/libs/query-client";
import { Router } from "~/router";
import "./app.css";

function RootLayout(props: { children: import("@solidjs/web").JSX.Element }) {
  onSettled(() => {
    useGlobalHaptics();
  });

  return (
    <div class="min-h-screen flex flex-col">
      <SkipLink />
      <ProgressBar />
      <Nav />
      <div class="flex-1">{props.children}</div>
      <Footer />
    </div>
  );
}

export default function App() {
  // On the server each request owns its query cache (locals.queryClient);
  // outside a request scope this is the shared fallback client.
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <Router>{(props) => <RootLayout>{props.children}</RootLayout>}</Router>
    </QueryClientProvider>
  );
}
