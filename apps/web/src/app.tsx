import * as stylex from "@stylexjs/stylex";
import { QueryClientProvider } from "@tanstack/solid-query";
import { Footer } from "@tom/ui/Footer";
import { Nav } from "@tom/ui/Nav";
import { SkipLink } from "@tom/ui/SkipLink";
import { ViewTransitions } from "@tom/ui/ViewTransitions";
import { useColorMode } from "@tom/ui/color-mode";
import { layout } from "@tom/ui/primitives.stylex";
import { getQueryClient } from "~/libs/query-client";
import { Router } from "~/router";
import { layoutStyles } from "~/components/layout.stylex";
import "./app.css";

function RootLayout(props: { children: import("@solidjs/web").JSX.Element }) {
  useColorMode();
  return (
    <ViewTransitions>
      <div {...stylex.attrs(layoutStyles.minHeightScreen, layout.flexCol)}>
        <SkipLink />
        <Nav />
        <div {...stylex.attrs(layoutStyles.flexOne)}>{props.children}</div>
        <Footer
          version={import.meta.env.VITE_APP_VERSION}
          commitHash={import.meta.env.VITE_COMMIT_HASH}
        />
      </div>
    </ViewTransitions>
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
