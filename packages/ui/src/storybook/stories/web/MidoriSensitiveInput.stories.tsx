import preview from "#.storybook/preview";
import { SensitiveInput } from "@tom/ui/sensitive-input";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/SensitiveInput",
  component: SensitiveInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onValueChange: fn(), onCopy: fn() },
});

export const Default = meta.story({
  args: {
    defaultValue: "secret-token-value",
  },
});

export const WithLabel = meta.story({
  args: {
    label: "API token",
    defaultValue: "secret-token-value",
  },
});

export const WithDescription = meta.story({
  args: {
    label: "API token",
    description: "Click the value to reveal it.",
    defaultValue: "secret-token-value",
  },
});

export const WithError = meta.story({
  args: {
    label: "API token",
    error: "Token is required.",
    defaultValue: "",
    placeholder: "Paste a token",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    defaultValue: "secret-token-value",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    defaultValue: "secret-token-value",
  },
});

export const Disabled = meta.story({
  args: {
    label: "API token",
    disabled: true,
    defaultValue: "secret-token-value",
  },
});
