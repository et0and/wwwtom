import { Loading, Show } from "solid-js";
import { isServer } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/solid-query";
import { Loader } from "@tom/ui/loader";
import {
  FRAME_SESSION_QUERY_KEY,
  FRAME_STATE_QUERY_KEY,
  errorMessage,
  loadFrameSession,
  loadFrameState,
} from "./api";
import { FrameEditor } from "./FrameEditor";
import { FrameLoadError } from "./FrameLoadError";
import { FrameSessionBar } from "./FrameSessionBar";
import { FrameSignIn } from "./FrameSignIn";
import { styles } from "./frame.stylex";

export function FrameControl() {
  const sessionQuery = useQuery(() => ({
    queryKey: FRAME_SESSION_QUERY_KEY,
    queryFn: loadFrameSession,
    enabled: !isServer,
    retry: false,
  }));

  const stateQuery = useQuery(() => ({
    queryKey: FRAME_STATE_QUERY_KEY,
    queryFn: loadFrameState,
    enabled: !isServer && sessionQuery.data !== null && sessionQuery.data !== undefined,
    retry: false,
  }));

  return (
    <div {...stylex.attrs(styles.stack)}>
      <Show when={!isServer} fallback={<Loader />}>
        <Loading fallback={<Loader />}>
          <Show
            when={sessionQuery.error}
            fallback={
              <Show when={sessionQuery.data} fallback={<FrameSignIn />}>
                {(session) => (
                  <>
                    <FrameSessionBar email={session().user.email} />
                    <Loading fallback={<Loader />}>
                      <Show
                        when={stateQuery.error}
                        fallback={
                          <Show when={stateQuery.data}>
                            {(frame) => <FrameEditor frame={frame()} />}
                          </Show>
                        }
                      >
                        {(error) => (
                          <FrameLoadError
                            title="Could not load the frame"
                            message={errorMessage(error())}
                            onRetry={() => void stateQuery.refetch()}
                          />
                        )}
                      </Show>
                    </Loading>
                  </>
                )}
              </Show>
            }
          >
            {(error) => (
              <FrameLoadError
                title="Could not load your session"
                message={errorMessage(error())}
                onRetry={() => void sessionQuery.refetch()}
              />
            )}
          </Show>
        </Loading>
      </Show>
    </div>
  );
}
