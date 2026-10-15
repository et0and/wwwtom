import * as stylex from "@stylexjs/stylex";
import preview from "#.storybook/preview";
import { buttonVariants } from "@tom/ui/button";
import { Collapsible } from "@tom/ui/collapsible";
import { colors } from "@tom/ui/colors.stylex";

const styles = stylex.create({
  framed: {
    width: "24rem",
    borderRadius: "0.5rem",
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"],
  },
  panel: {
    margin: 0,
    padding: "0.75rem",
    borderRadius: "0.5rem",
    backgroundColor: colors["--color-tomui-recessed"],
    fontSize: "0.875rem",
  },
  text: { marginBlockStart: "0.5rem", fontSize: "0.875rem" },
  wide: { width: "24rem" },
});

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
    <Collapsible style={styles.framed}>
      <Collapsible.DefaultTrigger>Project details</Collapsible.DefaultTrigger>
      <Collapsible.DefaultPanel>
        <p class="m-0 text-sm">Repository settings live here.</p>
      </Collapsible.DefaultPanel>
    </Collapsible>
  ),
});

export const Open = meta.story({
  render: () => (
    <Collapsible defaultOpen style={styles.framed}>
      <Collapsible.DefaultTrigger>Project details</Collapsible.DefaultTrigger>
      <Collapsible.DefaultPanel>
        <p class="m-0 text-sm">Repository settings live here.</p>
      </Collapsible.DefaultPanel>
    </Collapsible>
  ),
});

export const CustomTrigger = meta.story({
  render: () => (
    <Collapsible defaultOpen style={styles.wide}>
      <Collapsible.Trigger style={buttonVariants({ variant: "secondary" })}>
        Toggle notes
      </Collapsible.Trigger>
      <Collapsible.Panel style={styles.panel}>
        Meeting notes are visible while the panel is open.
      </Collapsible.Panel>
    </Collapsible>
  ),
});

export const KeepMounted = meta.story({
  render: () => (
    <Collapsible style={styles.wide}>
      <Collapsible.Trigger style={buttonVariants({ variant: "secondary" })}>
        Toggle panel
      </Collapsible.Trigger>
      <Collapsible.Panel keepMounted style={styles.text}>
        This panel stays mounted and hides with the hidden attribute.
      </Collapsible.Panel>
    </Collapsible>
  ),
});
