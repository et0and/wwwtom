import { Show, createSignal, untrack } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/solid-query";
import { Option, Schema } from "effect";
import { Banner } from "@tom/ui/banner";
import { Text } from "@tom/ui/text";
import { FrameStateUpdateSchema, type FrameMode, type FrameState } from "@tom/schemas/frame-state";
import { queryClient } from "~/data/query-client";
import { FRAME_STATE_QUERY_KEY, errorMessage, saveFrameState } from "./api";
import { FrameForm } from "./FrameForm";
import { styles } from "./frame.stylex";

export interface FrameEditorProps {
  readonly frame: FrameState;
}

export function FrameEditor(props: FrameEditorProps) {
  const initial = untrack(() => props.frame);
  const [mode, setMode] = createSignal<FrameMode>(initial.mode);
  const [channel, setChannel] = createSignal<string>(initial.channel ?? "");
  const [streamUrl, setStreamUrl] = createSignal(initial.streamUrl ?? "");
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  const saveMutation = useMutation(() => ({
    mutationFn: saveFrameState,
    onSuccess: (saved) => {
      setMode(saved.mode);
      setChannel(saved.channel ?? "");
      setStreamUrl(saved.streamUrl ?? "");
      queryClient.setQueryData(FRAME_STATE_QUERY_KEY, saved);
      setNotice("The board polls every 15 seconds.");
    },
  }));

  const submit = (): void => {
    const url = streamUrl().trim();
    const update = Schema.decodeUnknownOption(FrameStateUpdateSchema)({
      mode: mode(),
      channel: channel().trim(),
      streamUrl: url === "" ? null : url,
    });
    if (Option.isNone(update)) {
      setValidationError("Enter an are.na channel and an http(s) MJPEG URL.");
      return;
    }
    setValidationError(null);
    setNotice(null);
    saveMutation.reset();
    saveMutation.mutate(update.value);
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
      <Show when={validationError()}>
        {(message) => (
          <Banner variant="error" title="Check the frame settings" description={message()} />
        )}
      </Show>
      <Show when={notice()}>
        {(message) => <Banner variant="default" title="Frame updated" description={message()} />}
      </Show>

      <FrameForm
        mode={mode()}
        channel={channel()}
        streamUrl={streamUrl()}
        busy={saveMutation.isPending}
        onModeChange={setMode}
        onChannelChange={setChannel}
        onStreamUrlChange={setStreamUrl}
        onSubmit={submit}
      />

      <Text variant="secondary" size="sm">
        {updatedLabel()}
      </Text>
    </div>
  );
}
