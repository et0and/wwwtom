import * as stylex from "@stylexjs/stylex";

/**
 * Styles for the PDF dialog. The panel itself uses `surface="full"` on Dialog,
 * which owns its responsive layout, so this file only covers the interior.
 */
export const pdfDialogStyles = stylex.create({
  /** The panel stacks its header above the embedded viewer. */
  panel: { display: "flex", flexDirection: "column" },

  title: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  close: {
    cursor: "pointer",
    borderWidth: 0,
    backgroundColor: "transparent",
    padding: 0,
  },
});
