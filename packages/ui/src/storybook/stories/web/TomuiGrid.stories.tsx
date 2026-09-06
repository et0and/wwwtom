import preview from "#.storybook/preview";
import { Grid, GridItem } from "@tom/ui/tomui/grid";

const meta = preview.meta({
  title: "web/Grid",
  component: Grid,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const cardClass = "rounded-lg bg-tomui-tint p-4 text-sm";

export const TwoUp = meta.story({
  render: () => (
    <Grid variant="2up">
      <GridItem class={cardClass}>First panel</GridItem>
      <GridItem class={cardClass}>Second panel</GridItem>
    </Grid>
  ),
});

export const SideBySide = meta.story({
  render: () => (
    <Grid variant="side-by-side">
      <GridItem class={cardClass}>Left</GridItem>
      <GridItem class={cardClass}>Right</GridItem>
    </Grid>
  ),
});

export const ThreeUp = meta.story({
  render: () => (
    <Grid variant="3up">
      <GridItem class={cardClass}>First</GridItem>
      <GridItem class={cardClass}>Second</GridItem>
      <GridItem class={cardClass}>Third</GridItem>
    </Grid>
  ),
});

export const TwoOneSplit = meta.story({
  render: () => (
    <Grid variant="2-1">
      <GridItem class={cardClass}>Main content</GridItem>
      <GridItem class={cardClass}>Aside</GridItem>
    </Grid>
  ),
});

export const NoGap = meta.story({
  render: () => (
    <Grid variant="2up" gap="none">
      <GridItem class={cardClass}>First</GridItem>
      <GridItem class={cardClass}>Second</GridItem>
    </Grid>
  ),
});

export const LargeGap = meta.story({
  render: () => (
    <Grid variant="2up" gap="lg">
      <GridItem class={cardClass}>First</GridItem>
      <GridItem class={cardClass}>Second</GridItem>
    </Grid>
  ),
});
