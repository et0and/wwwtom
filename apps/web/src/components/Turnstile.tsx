import { createEffect, onCleanup } from "solid-js";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
};

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Read at call time (not module scope) so tests can stub the env before
 * mounting. Inlined by Vite from the Alchemy VITE_ prefix at build time;
 * absent in local dev, where the widget renders nothing.
 */
export const getTurnstileSitekey = (): string | undefined =>
  import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;

let scriptLoadPromise: Promise<boolean> | undefined;

const loadTurnstileScript = (): Promise<boolean> => {
  // Already loaded (or stubbed in tests) — nothing to inject.
  if (window.turnstile) return Promise.resolve(true);
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
};

type TurnstileProps = {
  /** Siteverify action — must match the backend's expected action. */
  action: string;
  /** Bump to re-render a fresh widget (tokens are single-use). */
  attempt?: number;
  /** Called with a fresh token once the challenge is solved. */
  onToken: (token: string) => void;
  /** Called when a previously issued token expires. */
  onExpire?: () => void;
};

/**
 * Reusable Cloudflare Turnstile widget. Renders nothing when the sitekey is
 * not configured (local dev without the Alchemy binding), loads the widget
 * script once, and re-renders a fresh widget whenever `attempt` changes so
 * callers can enforce token single-use.
 */
export function Turnstile(props: TurnstileProps) {
  let containerRef: HTMLDivElement | undefined;
  let currentWidgetId: string | undefined;
  let renderGeneration = 0;

  createEffect(() => {
    // Track `attempt` so bumping it re-runs this effect.
    void props.attempt;
    const container = containerRef;
    const sitekey = getTurnstileSitekey();
    if (!container || !sitekey) return;

    if (currentWidgetId) window.turnstile?.remove(currentWidgetId);
    currentWidgetId = undefined;

    // Stale-render guard: an `attempt` bump while the script is still
    // loading must not render the previous attempt's widget.
    const generation = ++renderGeneration;
    loadTurnstileScript().then((loaded) => {
      if (!loaded || generation !== renderGeneration || !window.turnstile) return;
      currentWidgetId = window.turnstile.render(container, {
        sitekey,
        action: props.action,
        callback: (token) => props.onToken(token),
        "expired-callback": () => props.onExpire?.(),
      });
    });
  });

  onCleanup(() => {
    if (currentWidgetId) window.turnstile?.remove(currentWidgetId);
  });

  return (
    <div
      ref={(element) => {
        containerRef = element;
      }}
    />
  );
}
