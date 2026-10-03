import { For, merge, type Merge } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { Text } from "@tom/ui/text";
import { layout, overflow } from "@tom/ui/primitives.stylex";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

const blurInChar = stylex.keyframes({
  from: { filter: "blur(0.3em)", opacity: 0 },
  to: { filter: "blur(0)", opacity: 1 },
});

const styles = stylex.create({
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  animateBlurInChar: {
    animationName: { default: blurInChar, [REDUCED_MOTION]: "none" },
    animationDuration: "0.3s",
    animationTimingFunction: "ease-in",
    opacity: { default: 0, [REDUCED_MOTION]: 1 },
    filter: { default: "blur(0.3em)", [REDUCED_MOTION]: "none" },
  },
});

interface BlurInTextProps {
  text: string;
  style?: stylex.StyleXStyles;
  baseDelay?: number;
  step?: number;
  tag?: "h1" | "h2" | "span";
}

const BlurInTextBody = (props: {
  merged: Merge<
    [{ style?: stylex.StyleXStyles; baseDelay: number; step: number }, BlurInTextProps]
  >;
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
      <span {...stylex.attrs(styles.srOnly)}>{props.merged.text}</span>
      <span aria-hidden="true">
        <For each={words()} keyed={false}>
          {(word) => (
            <>
              <span {...stylex.attrs(layout.inlineBlock, overflow.noWrap)}>
                <For each={word().chars} keyed={false}>
                  {(charObj) => (
                    <span
                      {...stylex.attrs(styles.animateBlurInChar, layout.inlineBlock)}
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
                  {...stylex.attrs(styles.animateBlurInChar, layout.inlineBlock)}
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
  const merged = merge({ baseDelay: 0, step: 0.025 }, props);
  const tag = props.tag ?? "span";

  if (tag === "h1") {
    return (
      <Text variant="heading" size="lg" as="h1" style={merged.style}>
        <BlurInTextBody merged={merged} />
      </Text>
    );
  }
  if (tag === "h2") {
    return (
      <Text variant="heading" as="h2" style={merged.style}>
        <BlurInTextBody merged={merged} />
      </Text>
    );
  }
  return (
    <Text as="span" style={merged.style}>
      <BlurInTextBody merged={merged} />
    </Text>
  );
}
