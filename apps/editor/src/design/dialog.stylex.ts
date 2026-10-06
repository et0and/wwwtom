import * as stylex from "@stylexjs/stylex";

/** Dialog body layouts used by the editor's insert dialogs. */
export const dialogStyles = stylex.create({
  body: {
    display: "grid",
    gap: "0.75rem",
    paddingInline: "1rem",
    paddingBlock: "0.75rem",
  },
  scrollableBody: {
    display: "grid",
    gap: "0.75rem",
    maxHeight: "80dvh",
    overflowY: "auto",
    paddingInline: "1rem",
    paddingBlock: "0.75rem",
  },
  title: { fontSize: "0.875rem", fontWeight: 600 },
});
