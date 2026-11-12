import preview from "#.storybook/preview";
import { Dialog } from "@tom/ui/dialog";
import { Input } from "@tom/ui/input";
import { Field } from "@tom/ui/field";

const meta = preview.meta({
  title: "web/Dialog",
  component: Dialog.Root,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Open = meta.story({
  render: () => (
    <Dialog.Root defaultOpen>
      <Dialog>
        <Dialog.Header>
          <Dialog.TitleGroup
            title="Edit profile"
            description="Make changes to your profile here."
          />
        </Dialog.Header>
        <Dialog.Body>
          <div
            style={{ display: "flex", width: "100%", "flex-direction": "column", gap: "0.75rem" }}
          >
            <Field label="Display name">
              <Input value="Tom" />
            </Field>
            <Field label="Email">
              <Input value="tom@example.com" type="email" />
            </Field>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close variant="neutral">Cancel</Dialog.Close>
          <Dialog.Close variant="primary">Save changes</Dialog.Close>
        </Dialog.Footer>
      </Dialog>
    </Dialog.Root>
  ),
});

export const WithTrigger = meta.story({
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger style={buttonVariants({ variant: "secondary" })}>Open dialog</Dialog.Trigger>
      <Dialog>
        <Dialog.Header>
          <Dialog.TitleGroup title="Notifications" description="You have 3 unread messages." />
        </Dialog.Header>
        <Dialog.Body>Messages will appear here.</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close variant="primary">Got it</Dialog.Close>
        </Dialog.Footer>
      </Dialog>
    </Dialog.Root>
  ),
});

export const Large = meta.story({
  render: () => (
    <Dialog.Root defaultOpen>
      <Dialog size="lg">
        <Dialog.Header>
          <Dialog.TitleGroup title="Large dialog" description="Complex content goes here." />
        </Dialog.Header>
        <Dialog.Body>
          <p style={{ margin: 0, "font-size": "13px", "line-height": "20px" }}>
            The panel grows to 40rem and the body scrolls when the content is taller than the
            viewport.
          </p>
        </Dialog.Body>
      </Dialog>
    </Dialog.Root>
  ),
});
