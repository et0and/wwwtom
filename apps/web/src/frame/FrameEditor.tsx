import { Show, createSignal, untrack } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/solid-query";
import { Banner } from "@tom/ui/banner";
import { Text } from "@tom/ui/text";
import type { FrameMode, FrameState } from "@tom/schemas/frame-state";
import { queryClient } from "~/data/query-client";
import { FRAME_STATE_QUERY_KEY, errorMessage, saveFrameState } from "./api";
import { FrameForm } from "./FrameForm";
import { GavinPanel } from "./GavinPanel";
import { styles } from "./frame.stylex";

export interface FrameEditorProps {
  readonly frame: FrameState;
}

export function FrameEditor(props: FrameEditorProps) {
  const initial = untrack(() => props.frame);
  const [mode, setMode] = createSignal<FrameMode>(initial.mode);
  const [channel, setChannel] = createSignal(initial.channel ?? "");
  const [notice, setNotice] = createSignal<string | null>(null);

  const saveMutation = useMutation(() => ({
    mutationFn: saveFrameState,
    onSuccess: (saved) => {
      setMode(saved.mode);
      setChannel(saved.channel ?? "");
      queryClient.setQueryData(FRAME_STATE_QUERY_KEY, saved);
      setNotice("The board polls every 15 seconds.");
    },
  }));

  const submit = (): void => {
    // A channel is only editable in deck mode; other modes keep the channel
    // already stored so the board's deck survives the round trip.
    const channelValue = mode() === "deck" ? channel().trim() : (props.frame.channel ?? "");
    setNotice(null);
    saveMutation.reset();
    saveMutation.mutate({ mode: mode(), channel: channelValue === "" ? null : channelValue });
  };

  const changeMode = (next: FrameMode): void => {
    setNotice(null);
    saveMutation.reset();
    setMode(next);
  };

  const updatedLabel = (): string => {
    const timestamp = new Date(props.frame.updatedAt).getTime();
    return timestamp === 0
      ? "Using defaults"
      : `Last set ${new Date(props.frame.updatedAt).toLocaleString()}`;
  };

  return (
    <div {...stylex.attrs(styles.stack)}>
      <Show when={saveMutation.error}>
        {(error) => (
          <Banner
            variant="error"
            title="Could not update the frame"
            description={errorMessage(error())}
          />
        )}
      </Show>
      <Show when={notice()}>
        {(message) => <Banner variant="default" title="Frame updated" description={message()} />}
      </Show>

      <FrameForm
        mode={mode()}
        channel={channel()}
        busy={saveMutation.isPending}
        onModeChange={changeMode}
        onChannelChange={setChannel}
        onSubmit={submit}
      />

      <Show when={props.frame.mode === "gavin" ? props.frame : null}>
        {(frame) => <GavinPanel frame={frame()} />}
      </Show>

      <Text variant="secondary" size="sm">
        {updatedLabel()}
      </Text>
    </div>
  );
}
