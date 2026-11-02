import { For } from "solid-js";
import { Schema } from "effect";
import { Radio } from "@tom/ui/radio";
import { FrameModeSchema, type FrameMode } from "@tom/schemas/frame-state";

const FRAME_MODES: ReadonlyArray<{ value: FrameMode; label: string }> = [
  { value: "deck", label: "Deck" },
  { value: "clock", label: "Clock" },
  { value: "video", label: "Video" },
  { value: "off", label: "Off" },
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
      orientation="horizontal"
      value={props.value}
      disabled={props.disabled}
      onValueChange={(value) => {
        if (Schema.is(FrameModeSchema)(value)) props.onChange(value);
      }}
    >
      <For each={FRAME_MODES}>{(mode) => <Radio.Item value={mode.value} label={mode.label} />}</For>
    </Radio>
  );
}
