import { onSettled } from "solid-js";

export type TomuiColorMode = "light" | "dark";

const COLOR_MODE_QUERY = "(prefers-color-scheme: dark)";

export function applyColorMode(mode: TomuiColorMode): void {
  document.documentElement.dataset.mode = mode;
  document.documentElement.style.colorScheme = mode;
}

/** Sync data-mode with the OS setting; returns a cleanup that stops listening. */
export function initColorMode(): () => void {
  const query = window.matchMedia(COLOR_MODE_QUERY);
  const sync = (): void => applyColorMode(query.matches ? "dark" : "light");
  sync();
  query.addEventListener("change", sync);
  return () => query.removeEventListener("change", sync);
}

/** Call once in a root component setup; follows OS theme changes. */
export function useColorMode(): void {
  onSettled(() => initColorMode());
}
