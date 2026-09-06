import preview from "#.storybook/preview";
import { Select } from "@tom/ui/tomui/select";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onChange: fn() },
});

const options = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

export const Default = meta.story({
  args: {
    options,
    value: "banana",
  },
});

export const WithPlaceholder = meta.story({
  args: {
    options,
    placeholder: "Pick a fruit…",
  },
});

export const Small = meta.story({
  args: {
    options,
    size: "sm",
    placeholder: "Small select",
  },
});

export const Large = meta.story({
  args: {
    options,
    size: "lg",
    placeholder: "Large select",
  },
});

export const Disabled = meta.story({
  args: {
    options,
    disabled: true,
    placeholder: "Disabled select",
  },
});
