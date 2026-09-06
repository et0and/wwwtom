import preview from "#.storybook/preview";
import { buttonVariants } from "@tom/ui/tomui/button";
import { DropdownMenu } from "@tom/ui/tomui/dropdown";

const meta = preview.meta({
  title: "web/Dropdown",
  component: DropdownMenu,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Open = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        Options
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Edit</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
        <DropdownMenu.Item>Archive</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});

export const WithSections = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        Account
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>Profile</DropdownMenu.Label>
        <DropdownMenu.Item>
          Settings
          <DropdownMenu.Shortcut>⌘S</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Billing</DropdownMenu.Label>
        <DropdownMenu.Item>Invoices</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});

export const Danger = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        Manage
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item variant="danger">Delete project</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});

export const WithCheckbox = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        View
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CheckboxItem defaultChecked>Show sidebar</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem>Show toolbar</DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});

export const WithRadio = meta.story({
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        Sort by
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.RadioGroup defaultValue="name">
          <DropdownMenu.RadioItem value="name">Name</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="date">Date</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="size">Size</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});

export const WithTrigger = meta.story({
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "secondary" })}>
        Open menu
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Profile</DropdownMenu.Item>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="danger">Sign out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
});
