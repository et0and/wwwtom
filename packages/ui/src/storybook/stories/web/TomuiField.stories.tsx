import preview from "#.storybook/preview";
import { Field } from "@tom/ui/field";
import { Input } from "@tom/ui/input";

const meta = preview.meta({
  title: "web/Field",
  component: Field,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  render: () => (
    <Field label="Username">
      <Input placeholder="tom" />
    </Field>
  ),
});

export const WithDescription = meta.story({
  render: () => (
    <Field label="Username" description="Lowercase letters and numbers only.">
      <Input placeholder="tom" />
    </Field>
  ),
});

export const WithError = meta.story({
  render: () => (
    <Field label="Email" error="Enter a valid email address.">
      <Input placeholder="you@example.com" type="email" />
    </Field>
  ),
});

export const Optional = meta.story({
  render: () => (
    <Field label="Nickname" required={false}>
      <Input placeholder="Tommy" />
    </Field>
  ),
});

export const HiddenLabel = meta.story({
  render: () => (
    <Field label="Search" hideLabel>
      <Input placeholder="Search…" type="search" />
    </Field>
  ),
});

export const ControlFirst = meta.story({
  render: () => (
    <Field label="Remember me" controlFirst>
      <Input type="checkbox" />
    </Field>
  ),
});
