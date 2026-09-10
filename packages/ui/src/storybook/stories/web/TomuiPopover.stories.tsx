import preview from "#.storybook/preview";
import { buttonVariants } from "@tom/ui/button";
import { Popover } from "@tom/ui/popover";

const meta = preview.meta({
  title: "web/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Bottom = meta.story({
  render: () => (
    <Popover defaultOpen>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>Details</Popover.Trigger>
      <Popover.Content>
        <Popover.Title>About this item</Popover.Title>
        <Popover.Description>Extra context appears here.</Popover.Description>
      </Popover.Content>
    </Popover>
  ),
});

export const Top = meta.story({
  render: () => (
    <Popover defaultOpen>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>Above</Popover.Trigger>
      <Popover.Content side="top">
        <Popover.Title>Above the trigger</Popover.Title>
        <Popover.Description>Side variant top.</Popover.Description>
      </Popover.Content>
    </Popover>
  ),
});

export const Left = meta.story({
  render: () => (
    <Popover defaultOpen>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>Left</Popover.Trigger>
      <Popover.Content side="left">
        <Popover.Title>To the left</Popover.Title>
        <Popover.Description>Side variant left.</Popover.Description>
      </Popover.Content>
    </Popover>
  ),
});

export const Right = meta.story({
  render: () => (
    <Popover defaultOpen>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>Right</Popover.Trigger>
      <Popover.Content side="right">
        <Popover.Title>To the right</Popover.Title>
        <Popover.Description>Side variant right.</Popover.Description>
      </Popover.Content>
    </Popover>
  ),
});

export const WithTrigger = meta.story({
  render: () => (
    <Popover>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>
        Open popover
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Title>Notifications</Popover.Title>
        <Popover.Description>You have 3 unread messages.</Popover.Description>
      </Popover.Content>
    </Popover>
  ),
});

export const WithClose = meta.story({
  render: () => (
    <Popover defaultOpen>
      <Popover.Trigger class={buttonVariants({ variant: "secondary" })}>Details</Popover.Trigger>
      <Popover.Content>
        <Popover.Title>Dismissible</Popover.Title>
        <Popover.Description>Close returns focus to the trigger.</Popover.Description>
        <Popover.Close class={buttonVariants({ variant: "primary" })}>Got it</Popover.Close>
      </Popover.Content>
    </Popover>
  ),
});
