import { WebHaptics, defaultPatterns } from "@tom/haptics";

let hapticsInstance: WebHaptics | null = null;
let listenerAdded = false;

export function useGlobalHaptics() {
  if (typeof window === "undefined") return;

  if (listenerAdded) return;

  if (!hapticsInstance) {
    hapticsInstance = new WebHaptics();
  }

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link && WebHaptics.isSupported) {
      hapticsInstance?.trigger(defaultPatterns.selection);
    }
  });

  listenerAdded = true;
}

export { hapticsInstance as haptics };
