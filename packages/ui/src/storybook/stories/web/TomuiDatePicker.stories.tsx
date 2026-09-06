import preview from "#.storybook/preview";
import { DatePicker } from "@tom/ui/tomui/date-picker";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/DatePicker",
  component: DatePicker,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onChange: fn() },
});

export const Default = meta.story({
  args: {
    value: "2026-09-06",
  },
});

export const WithPlaceholder = meta.story({
  args: {
    placeholder: "Select a date",
  },
});

export const ExtraSmall = meta.story({
  args: {
    size: "xs",
    value: "2026-09-06",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    value: "2026-09-06",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    value: "2026-09-06",
  },
});

export const Disabled = meta.story({
  args: {
    disabled: true,
    value: "2026-09-06",
  },
});
