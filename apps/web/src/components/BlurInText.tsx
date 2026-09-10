import { For, merge, type Merge } from "solid-js";
import { Text } from "@tom/ui/text";

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
    const charCounts = rawWords.map((word) => word.length);
    return rawWords.map((word, i) => {
      const precedingChars = charCounts.slice(0, i).reduce((sum, count) => sum + count + 1, 0);
      const chars = word
        .split("")
        .map((char, charIndex) => ({ char, globalIndex: precedingChars + charIndex }));
      const hasSpace = i < rawWords.length - 1;
      const spaceIndex = hasSpace ? precedingChars + word.length : -1;
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
      <Text variant="heading" size="lg" as="h1" class={merged.class}>
        <BlurInTextBody merged={merged} />
      </Text>
    );
  }
  if (tag === "h2") {
    return (
      <Text variant="heading" as="h2" class={merged.class}>
        <BlurInTextBody merged={merged} />
      </Text>
    );
  }
  return (
    <Text as="span" class={merged.class}>
      <BlurInTextBody merged={merged} />
    </Text>
  );
}
