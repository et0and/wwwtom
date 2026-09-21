import { createSignal } from "solid-js";
import { Portal } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { Dialog } from "@tom/ui/dialog";
import { Text } from "@tom/ui/text";

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
        class="block no-underline hover:underline"
        onClick={(event) => {
          if (!isDialogViewport() || !isPlainClick(event)) return;
          event.preventDefault();
          setIsOpen(true);
        }}
      >
        {props.children}
      </a>
      <Portal>
        <Dialog
          size="xl"
          class="rounded-none! top-0! left-0! h-dvh max-w-none! translate-x-0! sm:top-16! sm:left-1/2! sm:h-[80vh]! sm:max-w-[calc(100vw-2rem)]! sm:-translate-x-1/2! flex flex-col"
        >
          <div class="flex min-w-0 flex-col gap-2 border-b border-tomui-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
            <Dialog.Title class="min-w-0 truncate">
              <Text variant="heading" as="span">
                {props.title}
              </Text>
            </Dialog.Title>
            <div class="flex shrink-0 items-center gap-4 sm:gap-6">
              <a href={props.url} target="_blank" rel="noopener noreferrer">
                <Text variant="secondary" size="sm" as="span">
                  Open in a new tab
                </Text>
              </a>
              <Dialog.Close class="cursor-pointer border-0 bg-transparent p-0">
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
            class="h-full min-h-0 w-full flex-1"
          />
        </Dialog>
      </Portal>
    </Dialog.Root>
  );
}
