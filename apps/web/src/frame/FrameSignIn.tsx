import { Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/solid-query";
import { Banner } from "@tom/ui/banner";
import { Button } from "@tom/ui/button";
import { Text } from "@tom/ui/text";
import { errorMessage, startSignIn } from "./api";
import { styles } from "./frame.stylex";

export function FrameSignIn() {
  const signInMutation = useMutation(() => ({ mutationFn: startSignIn }));

  return (
    <div {...stylex.attrs(styles.stack)}>
      <Text>
        Sign in with GitHub to switch the frame between the are.na deck, the clock, and video mode.
      </Text>
      <Show when={signInMutation.error}>
        {(error) => (
          <Banner variant="error" title="Sign-in failed" description={errorMessage(error())} />
        )}
      </Show>
      <Button
        variant="primary"
        loading={signInMutation.isPending}
        disabled={signInMutation.isPending}
        onClick={() => signInMutation.mutate()}
      >
        Sign in with GitHub
      </Button>
    </div>
  );
}
