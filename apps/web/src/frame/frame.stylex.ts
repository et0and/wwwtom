import * as stylex from "@stylexjs/stylex";

export const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: "36rem",
  },
  sessionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: { width: "100%" },
  note: { marginTop: "-0.5rem" },
});
