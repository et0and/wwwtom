import { type JSX, onMount } from "solid-js";

interface ViewTransitionsProps {
  children: JSX.Element;
}

export function ViewTransitions(props: ViewTransitionsProps) {
  onMount(() => {
    if (!document.startViewTransition) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor || !anchor.href) return;

      // Only handle internal navigation
      const linkUrl = new URL(anchor.href);
      if (linkUrl.origin !== window.location.origin) return;

      // Check if user prefers reduced motion
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      // Check if transition is already in progress
      if ((document as any).transitioning) return;

      event.preventDefault();

      const transition = document.startViewTransition(() => {
        window.history.pushState({}, "", anchor.href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      (document as any).transitioning = true;
      transition.finished.then(() => {
        (document as any).transitioning = false;
      });
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  });

  return props.children;
}
