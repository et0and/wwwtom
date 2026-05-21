import type { JSX } from "solid-js";
import { mergeProps } from "solid-js";

interface BlurInSectionProps {
  children: JSX.Element;
  delay?: number;
  class?: string;
}

export function BlurInSection(props: BlurInSectionProps) {
  const merged = mergeProps({ delay: 0, class: "" }, props);

  return (
    <div
      class={`animate-blur-in [animation-fill-mode:both] ${merged.class}`}
      style={{ "animation-delay": `${merged.delay}s` }}
    >
      {merged.children}
    </div>
  );
}
