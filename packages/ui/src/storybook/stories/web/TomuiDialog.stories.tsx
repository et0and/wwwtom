import preview from "#.storybook/preview";
import * as stylex from "@stylexjs/stylex";
import { buttonVariants } from "@tom/ui/button";
import { Dialog } from "@tom/ui/dialog";
import { storyStyles } from "../story.stylex";

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
      <Dialog style={storyStyles.panel}>
        <Dialog.Title style={storyStyles.title}>Edit profile</Dialog.Title>
        <Dialog.Description style={storyStyles.description}>
          Make changes to your profile here. Click save when you are done.
        </Dialog.Description>
        <div {...stylex.attrs(storyStyles.actions)}>
          <Dialog.Close style={buttonVariants({ variant: "secondary" })}>Cancel</Dialog.Close>
          <Dialog.Close style={buttonVariants({ variant: "primary" })}>Save</Dialog.Close>
        </div>
      </Dialog>
    </Dialog.Root>
  ),
});

export const WithTrigger = meta.story({
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger style={buttonVariants({ variant: "secondary" })}>Open dialog</Dialog.Trigger>
      <Dialog style={storyStyles.panel}>
        <Dialog.Title style={storyStyles.title}>Notifications</Dialog.Title>
        <Dialog.Description style={storyStyles.description}>
          You have 3 unread messages.
        </Dialog.Description>
        <div {...stylex.attrs(storyStyles.actions)}>
          <Dialog.Close style={buttonVariants({ variant: "primary" })}>Got it</Dialog.Close>
        </div>
      </Dialog>
    </Dialog.Root>
  ),
});

export const Large = meta.story({
  render: () => (
    <Dialog.Root defaultOpen>
      <Dialog size="lg" style={storyStyles.panel}>
        <Dialog.Title style={storyStyles.title}>Large dialog</Dialog.Title>
        <Dialog.Description style={storyStyles.description}>
          Complex content goes here.
        </Dialog.Description>
      </Dialog>
    </Dialog.Root>
  ),
});
