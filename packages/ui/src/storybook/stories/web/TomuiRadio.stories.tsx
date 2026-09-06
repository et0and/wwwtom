import preview from "#.storybook/preview";
import { Radio } from "@tom/ui/tomui/radio";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Radio",
  component: Radio,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onValueChange: fn() },
});

export const Default = meta.story({
  render: () => (
    <Radio legend="Fruit" defaultValue="banana">
      <Radio.Item label="Apple" value="apple" />
      <Radio.Item label="Banana" value="banana" />
      <Radio.Item label="Cherry" value="cherry" />
    </Radio>
  ),
});

export const Horizontal = meta.story({
  render: () => (
    <Radio legend="Size" orientation="horizontal" defaultValue="base">
      <Radio.Item label="Small" value="sm" />
      <Radio.Item label="Base" value="base" />
      <Radio.Item label="Large" value="lg" />
    </Radio>
  ),
});

export const Cards = meta.story({
  render: () => (
    <Radio legend="Plan" appearance="card" defaultValue="pro">
      <Radio.Item label="Starter" description="For side projects." value="starter" />
      <Radio.Item label="Pro" description="For growing teams." value="pro" />
    </Radio>
  ),
});

export const WithError = meta.story({
  render: () => (
    <Radio legend="Fruit" error="Pick one option." defaultValue="apple">
      <Radio.Item label="Apple" value="apple" variant="error" />
      <Radio.Item label="Banana" value="banana" variant="error" />
    </Radio>
  ),
});

export const WithDescription = meta.story({
  render: () => (
    <Radio legend="Notifications" description="Choose how to hear from us.">
      <Radio.Item label="Email" value="email" />
      <Radio.Item label="SMS" value="sms" />
    </Radio>
  ),
});

export const Disabled = meta.story({
  render: () => (
    <Radio legend="Fruit" disabled defaultValue="banana">
      <Radio.Item label="Apple" value="apple" />
      <Radio.Item label="Banana" value="banana" />
    </Radio>
  ),
});
