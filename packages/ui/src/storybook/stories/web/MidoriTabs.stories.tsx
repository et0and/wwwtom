import preview from "#.storybook/preview";
import { Tabs } from "@tom/ui/tabs";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onValueChange: fn() },
});

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
  { value: "about", label: "About" },
];

export const Segmented = meta.story({
  args: {
    variant: "segmented",
    tabs,
    defaultValue: "overview",
  },
});

export const Underline = meta.story({
  args: {
    variant: "underline",
    tabs,
    defaultValue: "posts",
  },
});

export const Line = meta.story({
  args: {
    variant: "line",
    tabs,
    defaultValue: "overview",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    tabs,
    defaultValue: "overview",
  },
});

export const WithDisabled = meta.story({
  args: {
    tabs: [...tabs, { value: "archived", label: "Archived", disabled: true }],
    defaultValue: "overview",
  },
});
