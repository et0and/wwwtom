import preview from "#.storybook/preview";
import { Textarea } from "@tom/ui/textarea";

const meta = preview.meta({
  title: "web/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  render: (args) => (
    <div style={{ width: "20rem" }}>
      <Textarea {...args} />
    </div>
  ),
});

export const Default = meta.story({
  args: { placeholder: "Say something…" },
});

export const Invalid = meta.story({
  args: { invalid: true, value: "Too short." },
});

export const LayerSurface = meta.story({
  args: { surface: "layer-1", placeholder: "On a layer" },
});

export const Disabled = meta.story({
  args: { disabled: true, value: "Can't touch this" },
});
