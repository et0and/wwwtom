import { For, merge, type Merge } from "solid-js";

interface BlurInTextProps {
  text: string;
  class?: string;
  baseDelay?: number;
  step?: number;
  tag?: "h1" | "h2" | "span";
}

const BlurInTextBody = (props: {
  merged: Merge<[{ class: string; baseDelay: number; step: number }, BlurInTextProps]>;
}) => {
  const words = () => {
    const rawWords = props.merged.text.split(" ");
    let globalIndex = 0;
    return rawWords.map((word, i) => {
      const chars = word.split("").map((char) => ({
        char,
        globalIndex: globalIndex++,
      }));
      const hasSpace = i < rawWords.length - 1;
      const spaceIndex = hasSpace ? globalIndex++ : -1;
      return { chars, hasSpace, spaceIndex };
    });
  };

  return (
    <>
      <span class="sr-only">{props.merged.text}</span>
      <span aria-hidden="true">
        <For each={words()} keyed={false}>
          {(word) => (
            <>
              <span class="inline-block whitespace-nowrap">
                <For each={word().chars} keyed={false}>
                  {(charObj) => (
                    <span
                      class="animate-blur-in-char inline-block"
                      style={{
                        "animation-delay": `${props.merged.baseDelay + charObj().globalIndex * props.merged.step}s`,
                        "animation-fill-mode": "both",
                      }}
                    >
                      {charObj().char}
                    </span>
                  )}
                </For>
              </span>
              {word().hasSpace && (
                <span
                  class="animate-blur-in-char inline-block"
                  style={{
                    "animation-delay": `${props.merged.baseDelay + word().spaceIndex * props.merged.step}s`,
                    "animation-fill-mode": "both",
                  }}
                >
                  {"\u00A0"}
                </span>
              )}
            </>
          )}
        </For>
      </span>
    </>
  );
};

export function BlurInText(props: BlurInTextProps) {
  const merged = merge({ class: "", baseDelay: 0, step: 0.025 }, props);
  const tag = props.tag ?? "span";

  if (tag === "h1") {
    return (
      <h1 class={merged.class}>
        <BlurInTextBody merged={merged} />
      </h1>
    );
  }
  if (tag === "h2") {
    return (
      <h2 class={merged.class}>
        <BlurInTextBody merged={merged} />
      </h2>
    );
  }
  return (
    <span class={merged.class}>
      <BlurInTextBody merged={merged} />
    </span>
  );
}
