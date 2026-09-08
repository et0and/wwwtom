import { Effect } from "effect";
import { createSignal } from "solid-js";
import { Button } from "@tom/ui/tomui/button";
import { runClient } from "../lib/api";
import { authProvider, startSocialSignIn } from "../lib/session";

export const SignInButton = (props: {
  onError: (message: string) => void;
  navigate?: (url: string) => void;
}) => {
  const [isSigningIn, setIsSigningIn] = createSignal(false);

  const go = (url: string): void => {
    if (props.navigate) props.navigate(url);
    else window.location.assign(url);
  };

  const provider = authProvider();

  const onClick = (): void => {
    if (isSigningIn()) return;
    setIsSigningIn(true);
    void runClient(
      startSocialSignIn(provider).pipe(
        Effect.tap((url) => Effect.sync(() => go(url))),
        Effect.catch((cause) =>
          Effect.sync(() => {
            setIsSigningIn(false);
            props.onError(cause.message);
          }),
        ),
      ),
    );
  };

  return (
    <Button
      type="button"
      variant="primary"
      loading={isSigningIn()}
      onClick={onClick}
      class="active:brightness-95"
    >
      {provider === "google" ? "Sign in with Google" : "Sign in with GitHub"}
    </Button>
  );
};
