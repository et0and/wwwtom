import preview from "#.storybook/preview";
import { Field } from "@tom/ui/field";
import { Input } from "@tom/ui/input";
import { TextInput } from "@tom/ui/text-input";

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

export const Compound = meta.story({
  render: () => (
    <div style={{ width: "18rem" }}>
      <Field>
        <Field.Label>Amount</Field.Label>
        <Field.Prefix>Up to 100 coins.</Field.Prefix>
        <Field.Control>
          <TextInput numeric placeholder="10" />
        </Field.Control>
        <Field.Suffix>Rounded to the nearest coin.</Field.Suffix>
      </Field>
    </div>
  ),
});

export const Invalid = meta.story({
  render: () => (
    <Field invalid label="Amount" description="This field is in an error state.">
      <Input variant="error" placeholder="10" />
    </Field>
  ),
});
