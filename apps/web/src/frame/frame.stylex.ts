import * as stylex from "@stylexjs/stylex";
import { colors } from "@tom/ui/colors.stylex";

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
  gavinPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    paddingTop: "1rem",
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors["--color-tomui-line"],
  },
  gavinInputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "0.5rem",
  },
});
