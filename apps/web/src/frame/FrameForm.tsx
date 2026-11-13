import { Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Text } from "@tom/ui/text";
import type { FrameMode } from "@tom/schemas/frame-state";
import { ModePicker } from "./ModePicker";
import { styles } from "./frame.stylex";

export interface FrameFormProps {
  readonly mode: FrameMode;
  readonly channel: string;
  readonly busy: boolean;
  readonly onModeChange: (mode: FrameMode) => void;
  readonly onChannelChange: (channel: string) => void;
  readonly onSubmit: () => void;
}

export function FrameForm(props: FrameFormProps) {
  return (
    <form
      {...stylex.attrs(styles.form)}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <ModePicker value={props.mode} disabled={props.busy} onChange={props.onModeChange} />

      <Show when={props.mode === "deck"}>
        <Input
          label="are.na channel"
          type="text"
          name="channel"
          placeholder="imaginary-museum"
          value={props.channel}
          onInput={(event) => props.onChannelChange(event.currentTarget.value)}
          disabled={props.busy}
          style={styles.field}
        />
        <Text variant="secondary" size="sm" style={styles.note}>
          Leave blank to use the channel stored on the board.
        </Text>
      </Show>

      <Show when={props.mode === "gavin"}>
        <Text variant="secondary" size="sm" style={styles.note}>
          The talk controls appear below when Gavin is active.
        </Text>
      </Show>

      <Button type="submit" variant="primary" loading={props.busy} disabled={props.busy}>
        Apply
      </Button>
    </form>
  );
}
