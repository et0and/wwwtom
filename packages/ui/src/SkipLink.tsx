import * as stylex from "@stylexjs/stylex";
import { colors } from "./styles/colors.stylex";

const styles = stylex.create({
  link: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "clip",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
    ":focus": {
      width: "auto",
      height: "auto",
      margin: 0,
      overflow: "visible",
      clipPath: "none",
      whiteSpace: "normal",
      insetBlockStart: 0,
      insetInlineStart: "50%",
      transform: "translateX(-50%)",
      zIndex: 50,
      paddingInline: "1rem",
      paddingBlock: "0.5rem",
      backgroundColor: colors["--color-black"],
      color: colors["--color-white"],
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
