import { createSignal } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { Portal } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { colors } from "@tom/ui/colors.stylex";
import { Dialog } from "@tom/ui/dialog";
import { layout, overflow, spacing } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { layoutStyles } from "~/components/layout.stylex";
import { pdfDialogStyles } from "./pdf-dialog.stylex";

const SM = "@media (min-width: 640px)";

const styles = stylex.create({
  header: {
    display: "flex",
    flexDirection: { default: "column", [SM]: "row" },
    alignItems: { default: "normal", [SM]: "center" },
    justifyContent: { default: "normal", [SM]: "space-between" },
    gap: { default: "0.5rem", [SM]: "1.5rem" },
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors["--color-tomui-line"],
    paddingInline: { default: "1rem", [SM]: "1.25rem" },
  },
  actions: {
    display: "flex",
    gap: { default: "1rem", [SM]: "1.5rem" },
  },
  embed: {
    height: "100%",
    minHeight: 0,
  },
});

interface PdfDialogProps {
  url: string;
  title: string;
  children: JSX.Element;
}

/** From this width up the dialog replaces the browser's PDF viewer. */
const isDialogViewport = (): boolean => window.matchMedia("(min-width: 640px)").matches;

const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * A PDF attachment opens inline, in a square-cornered dialog. Full-screen on
 * phones; a centred 80vh panel from the sm breakpoint up.
 *
 * The trigger is a real link: phones and tablets hand the file to the native
 * viewer, because iOS and Android cannot render a PDF inside a page. Only a
 * plain click from sm up opens the dialog, so modified clicks still open a tab.
 *
 * The panel is portalled to the body: the body sections animate with a
 * transform, which would otherwise become the containing block for the
 * fixed-position dialog and break its sizing and backdrop. Safari synthesises
 * a wrapper document around a PDF-serving iframe and leaves it blank, so the
 * file renders in an embed instead.
 */
export function PdfDialog(props: PdfDialogProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Dialog.Root open={isOpen()} onOpenChange={setIsOpen}>
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        {...stylex.attrs(layout.block, layoutStyles.noUnderlineHover)}
        onClick={(event) => {
          if (!isDialogViewport() || !isPlainClick(event)) return;
          event.preventDefault();
          setIsOpen(true);
        }}
      >
        {props.children}
      </a>
      <Portal>
        <Dialog surface="full" style={pdfDialogStyles.panel}>
          <div {...stylex.attrs(styles.header, layout.minWidth0, spacing.py3)}>
            <Dialog.Title style={pdfDialogStyles.title}>
              <Text variant="heading" as="span">
                {props.title}
              </Text>
            </Dialog.Title>
            <div {...stylex.attrs(styles.actions, overflow.noShrink, layout.itemsCenter)}>
              <a href={props.url} target="_blank" rel="noopener noreferrer">
                <Text variant="secondary" size="sm" as="span">
                  Open in a new tab
                </Text>
              </a>
              <Dialog.Close style={pdfDialogStyles.close}>
                <Text variant="secondary" size="sm" as="span">
                  Close
                </Text>
              </Dialog.Close>
            </div>
          </div>
          <embed
            src={props.url}
            type="application/pdf"
            title={props.title}
            {...stylex.attrs(styles.embed, layout.fullWidth, layoutStyles.flexOne)}
          />
        </Dialog>
      </Portal>
    </Dialog.Root>
  );
}
