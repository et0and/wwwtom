import type { JSX } from "@solidjs/web";
import { HydrationScript } from "@solidjs/web";

/**
 * The full document shell, shared by the server render and the client
 * hydration so both allocate identical hydration keys.
 */
export function Document(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Sophie — writing" />
        <script>{`document.documentElement.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'`}</script>
        <HydrationScript />
        <script type="module" src="/src/entry-client.tsx" />
      </head>
      <body>
        <div id="app">{props.children}</div>
      </body>
    </html>
  );
}
