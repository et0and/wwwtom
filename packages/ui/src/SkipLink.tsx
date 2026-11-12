import { textColors } from "./styles/colors.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  link: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
    ":focus": {
      width: "auto",
      height: "auto",
      margin: 0,
      overflow: "visible",
      clip: "auto",
      whiteSpace: "normal",
      top: 0,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 50,
      paddingInline: "1rem",
      paddingBlock: "0.5rem",
      backgroundColor: textColors["--text-color-midori-strong"],
      color: textColors["--text-color-midori-inverse"],
      textDecorationLine: "underline",
      outlineWidth: 0,
    },
  },
});

export function SkipLink() {
  return (
    <a href="#main" {...stylex.attrs(styles.link)}>
      Skip to main content
    </a>
  );
}
