import { Errored, Loading, Show, createSignal, onSettled } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/solid-query";
import { Loader } from "@tom/ui/loader";
import { errorMessage } from "@tom/utils/http";
import {
  FRAME_SESSION_QUERY_KEY,
  FRAME_STATE_QUERY_KEY,
  loadFrameSession,
  loadFrameState,
} from "./api";
import { FrameEditor } from "./FrameEditor";
import { FrameLoadError } from "./FrameLoadError";
import { FrameSessionBar } from "./FrameSessionBar";
import { FrameSignIn } from "./FrameSignIn";
import { styles } from "./frame.stylex";

export function FrameControl() {
  const [isHydrated, setIsHydrated] = createSignal(false);
  onSettled(() => {
    setIsHydrated(true);
  });

  return (
    <Show when={isHydrated()} fallback={<Loader />}>
      <FrameControlContent />
    </Show>
  );
}

function FrameControlContent() {
  const sessionQuery = useQuery(() => ({
    queryKey: FRAME_SESSION_QUERY_KEY,
    queryFn: loadFrameSession,
    retry: false,
  }));

  return (
    <div {...stylex.attrs(styles.stack)}>
      <Loading fallback={<Loader />}>
        <Errored
          fallback={(error) => (
            <FrameLoadError
              title="Could not load your session"
              message={errorMessage(error())}
              onRetry={() => void sessionQuery.refetch()}
            />
          )}
        >
          <Show when={sessionQuery.data} fallback={<FrameSignIn />}>
            {(session) => <SignedInFrame email={session().user.email} />}
          </Show>
        </Errored>
      </Loading>
    </div>
  );
}

function SignedInFrame(props: { email: string }) {
  const stateQuery = useQuery(() => ({
    queryKey: FRAME_STATE_QUERY_KEY,
    queryFn: loadFrameState,
    retry: false,
  }));

  return (
    <>
      <FrameSessionBar email={props.email} />
      <Loading fallback={<Loader />}>
        <Errored
          fallback={(error) => (
            <FrameLoadError
              title="Could not load the frame"
              message={errorMessage(error())}
              onRetry={() => void stateQuery.refetch()}
            />
          )}
        >
          <Show when={stateQuery.data}>{(frame) => <FrameEditor frame={frame()} />}</Show>
        </Errored>
      </Loading>
    </>
  );
}
