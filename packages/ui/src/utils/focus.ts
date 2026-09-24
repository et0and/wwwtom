import { createEffect, onCleanup } from "solid-js";

const FOCUSABLE_SELECTOR = [
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "area[href]",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
]
  .map((s) => `${s}:not([aria-hidden])`)
  .join(",");

const TABBABLE_SELECTOR = `${FOCUSABLE_SELECTOR}:not([tabindex="-1"])`;

export function getTabbableIn(container: HTMLElement, includeContainer = false): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    isTabbable,
  );

  if (includeContainer && isTabbable(container)) {
    elements.unshift(container);
  }

  return elements;
}

export function isTabbable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.tabIndex < 0) return false;
  return isElementVisible(el);
}

export function isElementVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

export function focusWithoutScrolling(el: HTMLElement): void {
  const scrollableParents: Array<[HTMLElement, number, number]> = [];
  let parent = el.parentElement;

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if (
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflowX === "auto" ||
      style.overflowX === "scroll"
    ) {
      scrollableParents.push([parent, parent.scrollLeft, parent.scrollTop]);
    }
    parent = parent.parentElement;
  }

  el.focus({ preventScroll: true });

  for (const [parent, scrollLeft, scrollTop] of scrollableParents) {
    parent.scrollLeft = scrollLeft;
    parent.scrollTop = scrollTop;
  }
}

export interface FocusScopeOptions {
  enabled: () => boolean;
  trapFocus?: boolean | undefined;
  onMountAutoFocus?: ((event: Event) => void) | undefined;
  onUnmountAutoFocus?: ((event: Event) => void) | undefined;
}

export function createFocusScope(
  container: () => HTMLElement | undefined,
  options: FocusScopeOptions,
): void {
  let lastFocused: HTMLElement | null = null;

  createEffect(
    () => (options.enabled() ? container() : undefined),
    (el) => {
      if (!el) return;

      const previouslyFocused = document.activeElement as HTMLElement | null;

      const mountEvent = new CustomEvent("focusScope.autoFocusOnMount", {
        bubbles: false,
        cancelable: true,
      });
      options.onMountAutoFocus?.(mountEvent);

      if (!mountEvent.defaultPrevented) {
        setTimeout(() => {
          if (!el.isConnected) return;
          const [first] = getTabbableIn(el);
          focusWithoutScrolling(first ?? el);
        }, 0);
      }

      const handleFocusIn = (e: FocusEvent) => {
        if (!options.trapFocus) return;
        const target = e.target as HTMLElement;
        if (el.contains(target)) {
          lastFocused = target;
          return;
        }
        if (lastFocused && el.contains(lastFocused)) {
          focusWithoutScrolling(lastFocused);
        }
      };

      document.addEventListener("focusin", handleFocusIn);

      onCleanup(() => {
        document.removeEventListener("focusin", handleFocusIn);

        const unmountEvent = new CustomEvent("focusScope.autoFocusOnUnmount", {
          bubbles: false,
          cancelable: true,
        });
        options.onUnmountAutoFocus?.(unmountEvent);

        if (!unmountEvent.defaultPrevented) {
          setTimeout(() => {
            const active = document.activeElement;
            if (active && active !== document.body && !el.contains(active)) {
              return;
            }
            if (previouslyFocused && previouslyFocused.isConnected) {
              focusWithoutScrolling(previouslyFocused);
            } else {
              document.body.focus();
            }
          }, 0);
        }
      });
    },
  );
}

export interface HideOutsideOptions {
  enabled: () => boolean;
  targets: () => Array<HTMLElement | undefined>;
}

export function createHideOutside(options: HideOutsideOptions): void {
  createEffect(
    () => {
      if (!options.enabled()) return undefined;
      const targets = options.targets().filter(Boolean) as HTMLElement[];
      return targets.length > 0 ? targets : undefined;
    },
    (targets) => {
      if (!targets) return;

      const hiddenElements: Array<[HTMLElement, string | null]> = [];
      const stack: Array<HTMLElement> = [document.body];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (targets.some((t) => t === current || t.contains(current) || current.contains(t))) {
          for (let i = 0; i < current.children.length; i++) {
            stack.push(current.children[i] as HTMLElement);
          }
          continue;
        }

        if (current.hasAttribute("aria-live")) {
          for (let i = 0; i < current.children.length; i++) {
            stack.push(current.children[i] as HTMLElement);
          }
          continue;
        }

        const prevAriaHidden = current.getAttribute("aria-hidden");
        if (prevAriaHidden !== "true") {
          hiddenElements.push([current, prevAriaHidden]);
          current.setAttribute("aria-hidden", "true");
        }
      }

      onCleanup(() => {
        for (const [el, prev] of hiddenElements) {
          if (prev === null) el.removeAttribute("aria-hidden");
          else el.setAttribute("aria-hidden", prev);
        }
      });
    },
  );
}

export function createPreventScroll(enabled: () => boolean): void {
  createEffect(
    () => enabled(),
    (isEnabled) => {
      if (!isEnabled) return;

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      onCleanup(() => {
        document.body.style.overflow = prevOverflow;
      });
    },
  );
}
