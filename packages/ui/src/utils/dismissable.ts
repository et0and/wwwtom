import { createEffect, onCleanup } from "solid-js";

interface LayerRecord {
  node: HTMLElement;
  isPointerBlocking: boolean;
  dismiss: (() => void) | undefined;
}

const layerStack: LayerRecord[] = [];

export function isTopMostLayer(node: HTMLElement): boolean {
  const top = layerStack[layerStack.length - 1];
  return top?.node === node;
}

function updateBodyPointerEvents(): void {
  const hasBlocking = layerStack.some((l) => l.isPointerBlocking);
  document.body.style.pointerEvents = hasBlocking ? "none" : "";
}

function containsComposed(parent: Node | null, child: Node | null): boolean {
  let node = child;
  while (node) {
    if (node === parent) return true;
    const root = node.getRootNode();
    if (root instanceof ShadowRoot && root.host) {
      node = root.host;
    } else {
      return false;
    }
  }
  return false;
}

function getEventTarget(e: Event): Node | null {
  const path = e.composedPath();
  const target = path[0];
  return target instanceof Node ? target : e.target instanceof Node ? e.target : null;
}

export interface InteractOutsideOptions {
  enabled: () => boolean;
  shouldExcludeElement?: ((el: HTMLElement) => boolean) | undefined;
  onPointerDownOutside?: ((e: CustomEvent) => void) | undefined;
  onFocusOutside?: ((e: CustomEvent) => void) | undefined;
  onInteractOutside?: ((e: Event) => void) | undefined;
}

export function createInteractOutside(
  ref: () => HTMLElement | undefined,
  options: InteractOutsideOptions,
): void {
  createEffect(
    () => (options.enabled() ? ref() : undefined),
    (el) => {
      if (!el) return;

      let hasPointerDownOutside = false;

      const isTargetInside = (e: Event): boolean => {
        const target = getEventTarget(e);
        if (!target) return false;
        if (containsComposed(el, target)) return true;
        if (target instanceof Element) {
          if (target.closest("[data-tomui-top-layer]")) return true;
          if (options.shouldExcludeElement?.(target as HTMLElement)) return true;
        }
        return false;
      };

      const handlePointerDown = (e: Event) => {
        if (isTargetInside(e)) return;
        const isContextMenu =
          (e as MouseEvent).button === 2 ||
          ((e as MouseEvent).ctrlKey && navigator.platform.includes("Mac"));

        const customEvent = new CustomEvent("interactOutside.pointerDownOutside", {
          bubbles: true,
          cancelable: true,
          detail: { originalEvent: e, isContextMenu },
        });
        options.onPointerDownOutside?.(customEvent);

        if (!customEvent.defaultPrevented) {
          hasPointerDownOutside = true;
          options.onInteractOutside?.(e);
        }
      };

      const handleFocusIn = (e: Event) => {
        if (isTargetInside(e)) return;
        if (hasPointerDownOutside) {
          hasPointerDownOutside = false;
          return;
        }
        const customEvent = new CustomEvent("interactOutside.focusOutside", {
          bubbles: true,
          cancelable: true,
          detail: { originalEvent: e },
        });
        options.onFocusOutside?.(customEvent);

        if (!customEvent.defaultPrevented) {
          options.onInteractOutside?.(e);
        }
      };

      const timer = setTimeout(() => {
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("focusin", handleFocusIn, true);
      }, 0);

      onCleanup(() => {
        clearTimeout(timer);
        document.removeEventListener("pointerdown", handlePointerDown, true);
        document.removeEventListener("focusin", handleFocusIn, true);
      });
    },
  );
}

export interface DismissableLayerOptions {
  enabled: () => boolean;
  disableOutsidePointerEvents?: boolean | undefined;
  excludedElements?: Array<() => HTMLElement | undefined> | undefined;
  onEscapeKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  onPointerDownOutside?: ((e: CustomEvent) => void) | undefined;
  onFocusOutside?: ((e: CustomEvent) => void) | undefined;
  onInteractOutside?: ((e: Event) => void) | undefined;
  onDismiss?: (() => void) | undefined;
  bypassTopMostLayerCheck?: boolean | undefined;
}

export function createDismissableLayer(
  ref: () => HTMLElement | undefined,
  options: DismissableLayerOptions,
): void {
  createEffect(
    () => (options.enabled() ? ref() : undefined),
    (el) => {
      if (!el) return;

      const record: LayerRecord = {
        node: el,
        isPointerBlocking: options.disableOutsidePointerEvents ?? false,
        dismiss: options.onDismiss,
      };
      layerStack.push(record);
      updateBodyPointerEvents();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        if (!options.bypassTopMostLayerCheck && !isTopMostLayer(el)) return;
        options.onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) {
          e.preventDefault();
          options.onDismiss?.();
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      let hasPointerDownOutside = false;

      const isTargetInside = (e: Event): boolean => {
        const target = getEventTarget(e);
        if (!target) return false;
        if (containsComposed(el, target)) return true;
        if (target instanceof Element) {
          if (target.closest("[data-tomui-top-layer]")) return true;
          const excluded = options.excludedElements ?? [];
          if (
            excluded.some((fn) => {
              const exclEl = fn();
              return exclEl ? exclEl.contains(target) : false;
            })
          ) {
            return true;
          }
        }
        return false;
      };

      const handlePointerDown = (e: Event) => {
        if (isTargetInside(e)) return;
        if (!options.bypassTopMostLayerCheck && !isTopMostLayer(el)) return;
        const isContextMenu =
          (e as MouseEvent).button === 2 ||
          ((e as MouseEvent).ctrlKey && navigator.platform.includes("Mac"));
        const customEvent = new CustomEvent("interactOutside.pointerDownOutside", {
          bubbles: true,
          cancelable: true,
          detail: { originalEvent: e, isContextMenu },
        });
        options.onPointerDownOutside?.(customEvent);
        if (!customEvent.defaultPrevented) {
          hasPointerDownOutside = true;
          options.onInteractOutside?.(e);
          if (!e.defaultPrevented) options.onDismiss?.();
        }
      };

      const handleFocusIn = (e: Event) => {
        if (isTargetInside(e)) return;
        if (hasPointerDownOutside) {
          hasPointerDownOutside = false;
          return;
        }
        const customEvent = new CustomEvent("interactOutside.focusOutside", {
          bubbles: true,
          cancelable: true,
          detail: { originalEvent: e },
        });
        options.onFocusOutside?.(customEvent);
        if (!customEvent.defaultPrevented) {
          options.onInteractOutside?.(e);
          if (!e.defaultPrevented) options.onDismiss?.();
        }
      };

      const timer = setTimeout(() => {
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("focusin", handleFocusIn, true);
      }, 0);

      onCleanup(() => {
        clearTimeout(timer);
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("pointerdown", handlePointerDown, true);
        document.removeEventListener("focusin", handleFocusIn, true);
        const index = layerStack.indexOf(record);
        if (index !== -1) layerStack.splice(index, 1);
        updateBodyPointerEvents();
      });
    },
  );
}
