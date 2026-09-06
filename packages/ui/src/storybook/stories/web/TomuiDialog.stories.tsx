import preview from "#.storybook/preview";
import { buttonVariants } from "@tom/ui/tomui/button";
import { Dialog } from "@tom/ui/tomui/dialog";

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
      <Dialog class="w-sm p-6">
        <Dialog.Title class="text-lg font-semibold">Edit profile</Dialog.Title>
        <Dialog.Description class="mt-1 text-sm">
          Make changes to your profile here. Click save when you are done.
        </Dialog.Description>
        <div class="mt-4 flex justify-end gap-2">
          <Dialog.Close class={buttonVariants({ variant: "secondary" })}>Cancel</Dialog.Close>
          <Dialog.Close class={buttonVariants({ variant: "primary" })}>Save</Dialog.Close>
        </div>
      </Dialog>
    </Dialog.Root>
  ),
});

export const WithTrigger = meta.story({
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger class={buttonVariants({ variant: "secondary" })}>Open dialog</Dialog.Trigger>
      <Dialog class="w-sm p-6">
        <Dialog.Title class="text-lg font-semibold">Notifications</Dialog.Title>
        <Dialog.Description class="mt-1 text-sm">You have 3 unread messages.</Dialog.Description>
        <div class="mt-4 flex justify-end">
          <Dialog.Close class={buttonVariants({ variant: "primary" })}>Got it</Dialog.Close>
        </div>
      </Dialog>
    </Dialog.Root>
  ),
});

export const Large = meta.story({
  render: () => (
    <Dialog.Root defaultOpen>
      <Dialog size="lg" class="p-6">
        <Dialog.Title class="text-lg font-semibold">Large dialog</Dialog.Title>
        <Dialog.Description class="mt-1 text-sm">Complex content goes here.</Dialog.Description>
      </Dialog>
    </Dialog.Root>
  ),
});
