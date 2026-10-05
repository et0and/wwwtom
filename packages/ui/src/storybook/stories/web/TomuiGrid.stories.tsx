import * as stylex from "@stylexjs/stylex";
import { colors } from "@tom/ui/colors.stylex";
import preview from "#.storybook/preview";
import { Grid, GridItem } from "@tom/ui/grid";

const meta = preview.meta({
  title: "web/Grid",
  component: Grid,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const styles = stylex.create({
  card: {
    borderRadius: "0.5rem",
    backgroundColor: colors["--color-tomui-tint"],
    padding: "1rem",
    fontSize: "0.875rem",
  },
});

export const TwoUp = meta.story({
  render: () => (
    <Grid variant="2up">
      <GridItem style={styles.card}>First panel</GridItem>
      <GridItem style={styles.card}>Second panel</GridItem>
    </Grid>
  ),
});

export const SideBySide = meta.story({
  render: () => (
    <Grid variant="side-by-side">
      <GridItem style={styles.card}>Left</GridItem>
      <GridItem style={styles.card}>Right</GridItem>
    </Grid>
  ),
});

export const ThreeUp = meta.story({
  render: () => (
    <Grid variant="3up">
      <GridItem style={styles.card}>First</GridItem>
      <GridItem style={styles.card}>Second</GridItem>
      <GridItem style={styles.card}>Third</GridItem>
    </Grid>
  ),
});

export const TwoOneSplit = meta.story({
  render: () => (
    <Grid variant="2-1">
      <GridItem style={styles.card}>Main content</GridItem>
      <GridItem style={styles.card}>Aside</GridItem>
    </Grid>
  ),
});

export const NoGap = meta.story({
  render: () => (
    <Grid variant="2up" gap="none">
      <GridItem style={styles.card}>First</GridItem>
      <GridItem style={styles.card}>Second</GridItem>
    </Grid>
  ),
});

export const LargeGap = meta.story({
  render: () => (
    <Grid variant="2up" gap="lg">
      <GridItem style={styles.card}>First</GridItem>
      <GridItem style={styles.card}>Second</GridItem>
    </Grid>
  ),
});
