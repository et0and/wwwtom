import { useIsRouting } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

const TRICKLE_INTERVAL_MS = 200;
const SETTLE_MS = 200;
const FADE_MS = 300;
const MAX_PROGRESS = 0.9;

function trickle(progress: number): number {
  if (progress < 0.2) return progress + 0.1;
  if (progress < 0.5) return progress + 0.04;
  if (progress < 0.8) return progress + 0.02;
  if (progress < 0.99) return progress + 0.005;
  return progress;
}

export function ProgressBar() {
  const isRouting = useIsRouting();

  const [isVisible, setIsVisible] = createSignal(false);
  const [isLeaving, setIsLeaving] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  createEffect(
    () => isRouting(),
    (routing) => {
      if (routing) {
        setProgress(0);
        setIsLeaving(false);
        setIsVisible(true);

        const interval = setInterval(
          () => setProgress((n) => Math.min(trickle(n), MAX_PROGRESS)),
          TRICKLE_INTERVAL_MS,
        );
        return () => clearInterval(interval);
      }

      setProgress(1);

      const settle = setTimeout(() => setIsLeaving(true), SETTLE_MS);
      const remove = setTimeout(() => {
        setIsVisible(false);
        setIsLeaving(false);
        setProgress(0);
      }, SETTLE_MS + FADE_MS);
      return () => {
        clearTimeout(settle);
        clearTimeout(remove);
      };
    },
  );

  return (
    <Show when={isVisible()}>
      <div
        role="progressbar"
        aria-label="Loading"
        aria-valuenow={Math.round(progress() * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        class={["tom-progress", { "tom-progress-leaving": isLeaving() }]}
      >
        <div
          class="tom-progress-bar"
          style={{ transform: `translate3d(${(progress() - 1) * 100}%, 0, 0)` }}
        >
          <div class="tom-progress-peg" />
        </div>
      </div>
    </Show>
  );
}
