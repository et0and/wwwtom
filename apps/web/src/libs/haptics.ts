import { WebHaptics, defaultPatterns } from "web-haptics";
import { isServer } from "@solidjs/web";

interface HapticsState {
  instance: WebHaptics | null;
  listenerAdded: boolean;
}

const hapticsState: HapticsState = {
  instance: null,
  listenerAdded: false,
};

function isTouchDevice(): boolean {
  return !isServer && navigator.maxTouchPoints > 0;
}

function isRightClick(event: MouseEvent | TouchEvent): boolean {
  return event instanceof MouseEvent && event.type === "mousedown" && event.button !== 0;
}

function hasModifierKey(event: MouseEvent | TouchEvent): boolean {
  return (
    event instanceof MouseEvent &&
    event.type === "mousedown" &&
    (event.ctrlKey || event.metaKey || event.shiftKey)
  );
}

function shouldTriggerHaptic(target: HTMLElement, event: MouseEvent | TouchEvent): boolean {
  // Opt-out via data attribute
  if (target.closest("[data-no-haptic]")) return false;

  // Ignore right-click
  if (isRightClick(event)) return false;

  // Ignore modifier keys (new tab / download)
  if (hasModifierKey(event)) return false;

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
  if (hapticsState.listenerAdded) return;
  hapticsState.listenerAdded = true;

  // Support iOS even though isSupported returns false
  const canHaptic = WebHaptics.isSupported || isTouchDevice();
  if (!canHaptic) return;

  if (!hapticsState.instance) {
    hapticsState.instance = new WebHaptics({ debug: import.meta.env.DEV });
  }

  const handleHaptic = (event: MouseEvent | TouchEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (!shouldTriggerHaptic(target, event)) return;

    const pattern = getPatternForElement(target);
    hapticsState.instance?.trigger(defaultPatterns[pattern]);
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
      hapticsState.listenerAdded = false;
      hapticsState.instance = null;
    });
  }
}

export const haptics = (): WebHaptics | null => hapticsState.instance;
