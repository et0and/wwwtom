import { Index, mergeProps } from "solid-js";

interface BlurInTextProps {
  text: string;
  class?: string;
  baseDelay?: number;
  step?: number;
}

export function BlurInText(props: BlurInTextProps) {
  const merged = mergeProps(
    { class: "", baseDelay: 0, step: 0.025 },
    props,
  );
  const characters = () => merged.text.split("");

  return (
    <span class={merged.class}>
      <span class="sr-only">{merged.text}</span>
      <span aria-hidden="true">
        <Index each={characters()}>
          {(char, i) => (
            <span
              class="animate-blur-in-char inline-block"
              style={{
                "animation-delay": `${merged.baseDelay + i * merged.step}s`,
                "animation-fill-mode": "both",
              }}
            >
              {char() === " " ? "\u00A0" : char()}
            </span>
          )}
        </Index>
      </span>
    </span>
  );
}
