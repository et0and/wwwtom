import { Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/solid-query";
import { Banner } from "@tom/ui/banner";
import { Button } from "@tom/ui/button";
import { Text } from "@tom/ui/text";
import { queryClient } from "~/data/query-client";
import { FRAME_SESSION_QUERY_KEY, FRAME_STATE_QUERY_KEY, errorMessage, signOut } from "./api";
import { styles } from "./frame.stylex";

export interface FrameSessionBarProps {
  readonly email: string;
}

export function FrameSessionBar(props: FrameSessionBarProps) {
  const signOutMutation = useMutation(() => ({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(FRAME_SESSION_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: FRAME_STATE_QUERY_KEY });
    },
  }));

  return (
    <>
      <div {...stylex.attrs(styles.sessionRow)}>
        <Text variant="secondary" size="sm">
          Signed in as {props.email}
        </Text>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={signOutMutation.isPending}
          disabled={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
        >
          Sign out
        </Button>
      </div>
      <Show when={signOutMutation.error}>
        {(error) => (
          <Banner variant="error" title="Could not sign out" description={errorMessage(error())} />
        )}
      </Show>
    </>
  );
}
