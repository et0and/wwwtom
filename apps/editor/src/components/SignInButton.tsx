import { Effect } from "effect";
import { Button } from "@tom/ui/tomui/button";
import { runClient } from "../lib/api";
import { startGithubSignIn } from "../lib/session";

export const SignInButton = (props: {
  onError: (message: string) => void;
  navigate?: (url: string) => void;
}) => {
  const go = (url: string): void => {
    if (props.navigate) props.navigate(url);
    else window.location.assign(url);
  };

  const onClick = (): void => {
    void runClient(
      startGithubSignIn().pipe(
        Effect.tap((url) => Effect.sync(() => go(url))),
        Effect.catch((cause) => Effect.sync(() => props.onError(cause.message))),
      ),
    );
  };

  return (
    <Button type="button" variant="primary" onClick={onClick}>
      Sign in with GitHub
    </Button>
  );
};
