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
  readonly streamUrl: string;
  readonly busy: boolean;
  readonly onModeChange: (mode: FrameMode) => void;
  readonly onChannelChange: (channel: string) => void;
  readonly onStreamUrlChange: (url: string) => void;
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

      <Input
        label="are.na channel"
        type="text"
        name="channel"
        value={props.channel}
        onInput={(event) => props.onChannelChange(event.currentTarget.value)}
        required
        disabled={props.busy}
        style={styles.field}
      />

      <Show when={props.mode === "video"}>
        <Input
          label="MJPEG stream URL"
          type="url"
          name="streamUrl"
          placeholder="http://192.168.1.20:8080/stream.mjpg"
          value={props.streamUrl}
          onInput={(event) => props.onStreamUrlChange(event.currentTarget.value)}
          disabled={props.busy}
          style={styles.field}
        />
        <Text variant="secondary" size="sm" style={styles.note}>
          MJPEG only. The on-device decoder arrives in the next slice.
        </Text>
      </Show>

      <Button type="submit" variant="primary" loading={props.busy} disabled={props.busy}>
        Apply
      </Button>
    </form>
  );
}
