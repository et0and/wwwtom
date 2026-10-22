import { createSignal, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { createSoundEngine, type SoundEngine } from "./engine";

/** Anything a pointer press should click against. */
const PRESSABLE =
  'label, a[href], button, summary, select, input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"], [role="switch"], [role="menuitem"]';

/** Pressables whose activation changes state rather than navigating. */
const STATEFUL =
  'summary, select, input[type="checkbox"], input[type="radio"], [aria-pressed], [role="tab"], [role="switch"]';

interface PressedPointer {
  element: Element;
  pointerId: number;
}

const controlFor = (element: Element): Element => {
  const control = element instanceof HTMLLabelElement ? element.control : null;
  return control ?? element;
};

const isDisabled = (element: Element): boolean => {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.disabled;
  }
  return element.getAttribute("aria-disabled") === "true";
};

/**
 * One delegated listener pair drives every control on the page, so no component
 * has to know this layer exists. `press` fires on the way down and either
 * `release` or `toggle` on the way up, which is what gives a click its weight:
 * state-changing controls get the two-part sound, navigation a single one.
 *
 * A link click is covered by that pair, but the browser's own back and forward
 * controls are not: they land as `popstate` with no pointer events at all. That
 * gets the navigation tick too, so stepping through history sounds like
 * stepping through pages.
 */
export function SoundEffects(props: {
  children: JSX.Element;
  /** Swappable so tests can observe the calls without a real audio graph. */
  createEngine?: () => SoundEngine;
}) {
  const engine = (props.createEngine ?? createSoundEngine)();
  const [pressed, setPressed] = createSignal<PressedPointer | undefined>();

  onSettled(() => {
    const pressableFrom = (target: EventTarget | null): Element | undefined => {
      if (!(target instanceof Element)) return undefined;
      const element = target.closest(PRESSABLE);
      if (element === null || isDisabled(controlFor(element))) return undefined;
      return element;
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      engine.unlock();
      const element = pressableFrom(event.target);
      setPressed(element === undefined ? undefined : { element, pointerId: event.pointerId });
      if (element !== undefined) engine.play("press");
    };

    const onPointerUp = (event: PointerEvent): void => {
      const state = pressed();
      if (state === undefined || state.pointerId !== event.pointerId) return;
      setPressed(undefined);
      if (!(event.target instanceof Node) || !state.element.contains(event.target)) return;
      engine.play(controlFor(state.element).matches(STATEFUL) ? "toggle" : "release");
    };

    const onPointerCancel = (event: PointerEvent): void => {
      const state = pressed();
      if (state === undefined || state.pointerId !== event.pointerId) return;
      setPressed(undefined);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      const element = pressableFrom(event.target);
      if (element === undefined) return;
      engine.unlock();
      engine.play("press");
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const element = pressableFrom(event.target);
      if (element === undefined) return;
      engine.play(controlFor(element).matches(STATEFUL) ? "toggle" : "release");
    };

    /** Back, forward, and the mobile swipe-back gesture, which is `popstate` too. */
    const onPopState = (): void => {
      engine.unlock();
      engine.play("tick");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("popstate", onPopState);
    };
  });

  return <>{props.children}</>;
}
