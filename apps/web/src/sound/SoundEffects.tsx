import { onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { createSoundEngine, type SoundEngine } from "./engine";

/** Anything a pointer press should click against. */
const PRESSABLE =
  'a[href], button, summary, [role="button"], [role="tab"], [role="switch"], [role="menuitem"]';

/** Pressables whose activation changes state rather than navigating. */
const STATEFUL =
  'summary, input[type="checkbox"], input[type="radio"], [aria-pressed], [role="tab"], [role="switch"]';

/** Level for the transient click pair, which should sit under the page's content. */
const CLICK_VOLUME = 0.7;

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
 */
export function SoundEffects(props: {
  children: JSX.Element;
  /** Swappable so tests can observe the calls without a real audio graph. */
  createEngine?: () => SoundEngine;
}) {
  const engine = (props.createEngine ?? createSoundEngine)();
  let pressed: Element | undefined;

  onSettled(() => {
    const pressableFrom = (target: EventTarget | null): Element | undefined => {
      if (!(target instanceof Element)) return undefined;
      const element = target.closest(PRESSABLE);
      if (element === null || isDisabled(element)) return undefined;
      return element;
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      engine.unlock();
      pressed = pressableFrom(event.target);
      if (pressed !== undefined) engine.play("press", CLICK_VOLUME);
    };

    const onPointerUp = (): void => {
      if (pressed === undefined) return;
      const wasStateful = pressed.matches(STATEFUL);
      pressed = undefined;
      engine.play(wasStateful ? "toggle" : "release", CLICK_VOLUME);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      const element = pressableFrom(event.target);
      if (element === undefined) return;
      engine.unlock();
      engine.play("press", CLICK_VOLUME);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const element = pressableFrom(event.target);
      if (element === undefined) return;
      engine.play(element.matches(STATEFUL) ? "toggle" : "release", CLICK_VOLUME);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  });

  return <>{props.children}</>;
}
