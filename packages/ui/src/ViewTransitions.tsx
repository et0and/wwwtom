import { useBeforeLeave } from "@solidjs/router";
import type { JSX } from "@solidjs/web";

interface ViewTransitionsProps {
  children: JSX.Element;
}

/** Back/forward passes a signed history delta instead of a route path. */
const isHistoryDelta = (target: string | number): target is number => Number.isInteger(target);

/**
 * The router swaps routes in place, so `@view-transition` (hard loads only)
 * never fires for in-app navigation. The router has already decided where to
 * navigate by the time `useBeforeLeave` runs, so this only redirects that
 * approved navigation through `document.startViewTransition`. Browsers
 * without the API and users who prefer reduced motion fall through to the
 * router's own handling; hard document loads stay with the CSS at-rule.
 */
export function ViewTransitions(props: ViewTransitionsProps): JSX.Element {
  let isRetrying = false;

  useBeforeLeave((event) => {
    if (isRetrying || event.defaultPrevented) return;
    if (isHistoryDelta(event.to)) return;
    if (!document.startViewTransition) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Hash-only jumps stay with the router: animating them adds nothing.
    if (event.from.pathname + event.from.search === event.to.split("#")[0]) return;

    event.preventDefault();
    document.startViewTransition(() => {
      isRetrying = true;
      event.retry();
      isRetrying = false;
    });
  });

  return props.children;
}
