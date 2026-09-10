import preview from "#.storybook/preview";
import { buttonVariants } from "@tom/ui/button";
import { Collapsible } from "@tom/ui/collapsible";

const meta = preview.meta({
  title: "web/Collapsible",
  component: Collapsible,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Closed = meta.story({
  render: () => (
    <Collapsible class="w-sm rounded-lg ring ring-tomui-line">
      <Collapsible.DefaultTrigger>Project details</Collapsible.DefaultTrigger>
      <Collapsible.DefaultPanel>
        <p class="m-0 text-sm">Repository settings live here.</p>
      </Collapsible.DefaultPanel>
    </Collapsible>
  ),
});

export const Open = meta.story({
  render: () => (
    <Collapsible defaultOpen class="w-sm rounded-lg ring ring-tomui-line">
      <Collapsible.DefaultTrigger>Project details</Collapsible.DefaultTrigger>
      <Collapsible.DefaultPanel>
        <p class="m-0 text-sm">Repository settings live here.</p>
      </Collapsible.DefaultPanel>
    </Collapsible>
  ),
});

export const CustomTrigger = meta.story({
  render: () => (
    <Collapsible defaultOpen class="w-sm">
      <Collapsible.Trigger class={buttonVariants({ variant: "secondary" })}>
        Toggle notes
      </Collapsible.Trigger>
      <Collapsible.Panel class="mt-2 rounded-lg bg-tomui-recessed p-3 text-sm">
        Meeting notes are visible while the panel is open.
      </Collapsible.Panel>
    </Collapsible>
  ),
});

export const KeepMounted = meta.story({
  render: () => (
    <Collapsible class="w-sm">
      <Collapsible.Trigger class={buttonVariants({ variant: "secondary" })}>
        Toggle panel
      </Collapsible.Trigger>
      <Collapsible.Panel keepMounted class="mt-2 text-sm">
        This panel stays mounted and hides with the hidden attribute.
      </Collapsible.Panel>
    </Collapsible>
  ),
});
