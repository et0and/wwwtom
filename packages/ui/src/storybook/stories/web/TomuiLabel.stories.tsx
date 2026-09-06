import preview from "#.storybook/preview";
import { Label } from "@tom/ui/tomui/label";

const meta = preview.meta({
  title: "web/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    children: "Email",
  },
});

export const Optional = meta.story({
  args: {
    children: "Nickname",
    showOptional: true,
  },
});

export const WithTooltip = meta.story({
  args: {
    children: "Username",
    tooltip: "Lowercase letters and numbers only.",
  },
});

export const ForInput = meta.story({
  args: {
    htmlFor: "email-input",
    children: "Email",
  },
});

export const AsContent = meta.story({
  render: () => (
    <label class="inline-flex items-center gap-2">
      <input type="checkbox" />
      <Label asContent>Accept terms</Label>
    </label>
  ),
});
