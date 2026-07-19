import { Index, mergeProps } from "solid-js";
import { Dynamic } from "solid-js/web";

interface BlurInTextProps {
  text: string;
  class?: string;
  baseDelay?: number;
  step?: number;
  tag?: string;
}

export function BlurInText(props: BlurInTextProps) {
  const merged = mergeProps({ class: "", baseDelay: 0, step: 0.025, tag: "span" }, props);

  const words = () => {
    const rawWords = merged.text.split(" ");
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
    <Dynamic component={merged.tag} class={merged.class}>
      <span class="sr-only">{merged.text}</span>
      <span aria-hidden="true">
        <Index each={words()}>
          {(word) => (
            <>
              <span class="inline-block whitespace-nowrap">
                <Index each={word().chars}>
                  {(charObj) => (
                    <span
                      class="animate-blur-in-char inline-block"
                      style={{
                        "animation-delay": `${merged.baseDelay + charObj().globalIndex * merged.step}s`,
                        "animation-fill-mode": "both",
                      }}
                    >
                      {charObj().char}
                    </span>
                  )}
                </Index>
              </span>
              {word().hasSpace && (
                <span
                  class="animate-blur-in-char inline-block"
                  style={{
                    "animation-delay": `${merged.baseDelay + word().spaceIndex * merged.step}s`,
                    "animation-fill-mode": "both",
                  }}
                >
                  {"\u00A0"}
                </span>
              )}
            </>
          )}
        </Index>
      </span>
    </Dynamic>
  );
}
