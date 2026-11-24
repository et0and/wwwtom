import preview from "#.storybook/preview";
import { Input } from "@tom/ui/input";

const meta = preview.meta({
  title: "web/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    placeholder: "Type something…",
  },
});

export const WithLabel = meta.story({
  args: {
    label: "Email",
    placeholder: "you@example.com",
    type: "email",
  },
});

export const WithDescription = meta.story({
  args: {
    label: "Username",
    description: "Lowercase letters and numbers only.",
    placeholder: "tom",
  },
});

export const WithError = meta.story({
  args: {
    label: "Email",
    placeholder: "you@example.com",
    error: "Enter a valid email address.",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    placeholder: "Small input",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    placeholder: "Large input",
  },
});

export const Disabled = meta.story({
  args: {
    disabled: true,
    placeholder: "Disabled input",
  },
});
