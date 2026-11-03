import { For } from "solid-js";
import { Schema } from "effect";
import { Radio } from "@tom/ui/radio";
import { FrameModeSchema, type FrameMode } from "@tom/schemas/frame-state";

const FRAME_MODES: ReadonlyArray<{
  value: FrameMode;
  label: string;
  description: string;
}> = [
  {
    value: "deck",
    label: "Deck",
    description: "are.na channel slideshow, with the clock and weather over each image.",
  },
  {
    value: "clock",
    label: "Clock",
    description: "Clock and weather only. The two face buttons cycle the layout.",
  },
  {
    value: "video",
    label: "Video",
    description: "MJPEG stream. The board cannot play video yet.",
  },
  {
    value: "off",
    label: "Screen off",
    description: "Blank the display. The board stays online and keeps polling for changes.",
  },
];

export interface ModePickerProps {
  readonly value: FrameMode;
  readonly disabled: boolean;
  readonly onChange: (mode: FrameMode) => void;
}

export function ModePicker(props: ModePickerProps) {
  return (
    <Radio
      legend="Mode"
      description="What the frame shows. One mode at a time."
      appearance="card"
      orientation="vertical"
      value={props.value}
      disabled={props.disabled}
      onValueChange={(value) => {
        if (Schema.is(FrameModeSchema)(value)) props.onChange(value);
      }}
    >
      <For each={FRAME_MODES}>
        {(mode) => (
          <Radio.Item value={mode.value} label={mode.label} description={mode.description} />
        )}
      </For>
    </Radio>
  );
}
