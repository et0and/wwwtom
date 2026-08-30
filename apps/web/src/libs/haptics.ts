import { WebHaptics, defaultPatterns } from "web-haptics";
import { isServer } from "@solidjs/web";

let hapticsInstance: WebHaptics | null = null;
let listenerAdded = false;

function isTouchDevice(): boolean {
  return !isServer && navigator.maxTouchPoints > 0;
}

function shouldTriggerHaptic(target: HTMLElement, event: MouseEvent | TouchEvent): boolean {
  // Opt-out via data attribute
  if (target.closest("[data-no-haptic]")) return false;

  // Ignore right-click
  if (event.type === "mousedown" && (event as MouseEvent).button !== 0) {
    return false;
  }

  // Ignore modifier keys (new tab / download)
  if (
    event.type === "mousedown" &&
    ((event as MouseEvent).ctrlKey ||
      (event as MouseEvent).metaKey ||
      (event as MouseEvent).shiftKey)
  ) {
    return false;
  }

  const link = target.closest("a, button");
  if (!link) return false;

  return true;
}

function getPatternForElement(target: HTMLElement): keyof typeof defaultPatterns {
  const link = target.closest("a");
  if (link) {
    const href = link.getAttribute("href");
    if (href?.startsWith("http://") || href?.startsWith("https://")) {
      return "light"; // External link
    }
    return "selection"; // Internal nav
  }

  if (target.closest("button") || target.closest("[data-action]")) {
    return "medium"; // Action
  }

  return "selection";
}

export function useGlobalHaptics() {
  if (isServer) return;
  if (listenerAdded) return;
  listenerAdded = true;

  // Support iOS even though isSupported returns false
  const canHaptic = WebHaptics.isSupported || isTouchDevice();
  if (!canHaptic) return;

  if (!hapticsInstance) {
    hapticsInstance = new WebHaptics({ debug: import.meta.env.DEV });
  }

  const handleHaptic = (event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement;

    if (!shouldTriggerHaptic(target, event)) return;

    const pattern = getPatternForElement(target);
    hapticsInstance?.trigger(defaultPatterns[pattern]);
  };

  document.addEventListener("mousedown", handleHaptic, {
    capture: true,
  });
  document.addEventListener("touchstart", handleHaptic, {
    capture: true,
  });

  // Cleanup on HMR
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      document.removeEventListener("mousedown", handleHaptic);
      document.removeEventListener("touchstart", handleHaptic);
      listenerAdded = false;
      hapticsInstance = null;
    });
  }
}

export { hapticsInstance as haptics };
