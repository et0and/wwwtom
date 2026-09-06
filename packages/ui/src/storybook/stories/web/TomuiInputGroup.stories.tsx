import preview from "#.storybook/preview";
import { InputGroup } from "@tom/ui/tomui/input-group";

const meta = preview.meta({
  title: "web/InputGroup",
  component: InputGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  render: () => (
    <InputGroup>
      <InputGroup.Input placeholder="you@example.com" type="email" />
    </InputGroup>
  ),
});

export const WithLabel = meta.story({
  render: () => (
    <InputGroup label="Email">
      <InputGroup.Input placeholder="you@example.com" type="email" />
    </InputGroup>
  ),
});

export const WithAddon = meta.story({
  render: () => (
    <InputGroup>
      <InputGroup.Addon>@</InputGroup.Addon>
      <InputGroup.Input placeholder="username" />
    </InputGroup>
  ),
});

export const WithEndAddon = meta.story({
  render: () => (
    <InputGroup>
      <InputGroup.Input placeholder="amount" inputmode="decimal" />
      <InputGroup.Addon align="end">USD</InputGroup.Addon>
    </InputGroup>
  ),
});

export const WithError = meta.story({
  render: () => (
    <InputGroup label="Email" error="Enter a valid email address.">
      <InputGroup.Input placeholder="you@example.com" type="email" />
    </InputGroup>
  ),
});

export const Small = meta.story({
  render: () => (
    <InputGroup size="sm">
      <InputGroup.Addon>@</InputGroup.Addon>
      <InputGroup.Input placeholder="username" />
    </InputGroup>
  ),
});

export const Large = meta.story({
  render: () => (
    <InputGroup size="lg">
      <InputGroup.Addon>@</InputGroup.Addon>
      <InputGroup.Input placeholder="username" />
    </InputGroup>
  ),
});

export const Disabled = meta.story({
  render: () => (
    <InputGroup disabled>
      <InputGroup.Addon>@</InputGroup.Addon>
      <InputGroup.Input placeholder="username" />
    </InputGroup>
  ),
});
