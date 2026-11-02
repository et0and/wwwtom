import * as stylex from "@stylexjs/stylex";
import { For, Show, createSignal, onSettled } from "solid-js";
import { isServer } from "@solidjs/web";
import { Option, Schema } from "effect";
import { Banner } from "@tom/ui/banner";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Loader } from "@tom/ui/loader";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import {
  FrameStateSchema,
  FrameStateUpdateSchema,
  type FrameMode,
  type FrameState,
  type FrameStateUpdate,
} from "@tom/schemas/frame-state";
import { getAdapterBaseUrl } from "~/data/adapter";

const SessionSchema = Schema.Struct({
  user: Schema.Struct({
    email: Schema.String,
    name: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
type Session = typeof SessionSchema.Type;

const SignInResponseSchema = Schema.Struct({ url: Schema.String });
const ProblemSchema = Schema.Struct({ title: Schema.optional(Schema.String) });

const FRAME_MODES: ReadonlyArray<{ value: FrameMode; label: string }> = [
  { value: "deck", label: "Deck" },
  { value: "clock", label: "Clock" },
  { value: "video", label: "Video" },
  { value: "off", label: "Off" },
];

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: "36rem",
  },
  modeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  sessionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  field: { width: "100%" },
  note: { marginTop: "-0.5rem" },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
});

const adapterBase = (): string => getAdapterBaseUrl();

const messageFor = async (response: Response): Promise<string> => {
  const json: unknown = await response.json().catch(() => null);
  const problem = Option.getOrNull(Schema.decodeUnknownOption(ProblemSchema)(json));
  return problem?.title ?? `Request failed (${response.status})`;
};

const loadSession = async (): Promise<Session | null> => {
  const response = await fetch(`${adapterBase()}/auth/get-session`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(await messageFor(response));
  const json: unknown = await response.json();
  return Option.getOrNull(Schema.decodeUnknownOption(Schema.NullOr(SessionSchema))(json));
};

const loadFrameState = async (): Promise<FrameState> => {
  const response = await fetch(`${adapterBase()}/frame/state`, { credentials: "include" });
  if (!response.ok) throw new Error(await messageFor(response));
  const json: unknown = await response.json();
  const state = Option.getOrNull(Schema.decodeUnknownOption(FrameStateSchema)(json));
  if (state === null) throw new Error("The adapter returned an invalid frame state");
  return state;
};

const saveFrameState = async (update: FrameStateUpdate): Promise<FrameState> => {
  const response = await fetch(`${adapterBase()}/frame/state`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(await messageFor(response));
  const json: unknown = await response.json();
  const state = Option.getOrNull(Schema.decodeUnknownOption(FrameStateSchema)(json));
  if (state === null) throw new Error("The adapter returned an invalid frame state");
  return state;
};

const startSignIn = async (): Promise<void> => {
  const response = await fetch(`${adapterBase()}/auth/sign-in/social`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "github",
      callbackURL: `${window.location.origin}/frame`,
      disableRedirect: true,
    }),
  });
  if (!response.ok) throw new Error(await messageFor(response));
  const json: unknown = await response.json();
  const result = Option.getOrNull(Schema.decodeUnknownOption(SignInResponseSchema)(json));
  if (result === null) throw new Error("The adapter returned an invalid sign-in response");
  const url = new URL(result.url);
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("The adapter returned an untrusted sign-in URL");
  }
  window.location.assign(result.url);
};

const signOut = async (): Promise<void> => {
  const response = await fetch(`${adapterBase()}/auth/sign-out`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(await messageFor(response));
};

export default function FrameControl() {
  const [session, setSession] = createSignal<Session | null | undefined>(undefined);
  const [frame, setFrame] = createSignal<FrameState | null>(null);
  const [mode, setMode] = createSignal<FrameMode>("deck");
  const [channel, setChannel] = createSignal("imaginary-museum");
  const [streamUrl, setStreamUrl] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  const applyFrame = (next: FrameState): void => {
    setFrame(next);
    setMode(next.mode);
    setChannel(next.channel);
    setStreamUrl(next.streamUrl ?? "");
  };

  const load = async (): Promise<void> => {
    try {
      const current = await loadSession();
      setSession(current);
      if (current !== null) applyFrame(await loadFrameState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the frame");
      setSession(null);
    }
  };

  onSettled(() => {
    if (isServer) return;
    void load();
  });

  const signIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await startSignIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start sign-in");
      setBusy(false);
    }
  };

  const logOut = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setSession(null);
      setFrame(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    const url = streamUrl().trim();
    const candidate = {
      mode: mode(),
      channel: channel().trim(),
      streamUrl: url === "" ? null : url,
    };
    const update = Option.getOrNull(Schema.decodeUnknownOption(FrameStateUpdateSchema)(candidate));
    if (update === null) {
      setError("Enter an are.na channel and an http(s) MJPEG URL.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      applyFrame(await saveFrameState(update));
      setNotice("Frame updated. The board polls every 15 seconds.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the frame");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout title="Frame" description="Control the desk frame">
      <Text variant="heading" size="lg" as="h1">
        Frame
      </Text>
      <div {...stylex.attrs(styles.panel)}>
        <Show when={session() !== undefined} fallback={<Loader />}>
          <Show
            when={session()}
            fallback={<SignIn busy={busy()} error={error()} onSignIn={signIn} />}
          >
            {(current) => (
              <>
                <div {...stylex.attrs(styles.sessionRow)}>
                  <Text variant="secondary" size="sm">
                    Signed in as {current().user.email}
                  </Text>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy()}
                    onClick={() => void logOut()}
                  >
                    Sign out
                  </Button>
                </div>

                <Show when={error()}>
                  {(message) => <Banner variant="error" description={message()} />}
                </Show>
                <Show when={notice()}>
                  {(message) => <Banner variant="default" description={message()} />}
                </Show>

                <form
                  {...stylex.attrs(styles.form)}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <Text as="span" bold>
                    Mode
                  </Text>
                  <div {...stylex.attrs(styles.modeRow)}>
                    <For each={FRAME_MODES}>
                      {(item) => (
                        <Button
                          type="button"
                          variant={mode() === item.value ? "primary" : "secondary"}
                          disabled={busy()}
                          onClick={() => setMode(item.value)}
                        >
                          {item.label}
                        </Button>
                      )}
                    </For>
                  </div>

                  <Input
                    label="are.na channel"
                    type="text"
                    name="channel"
                    value={channel()}
                    onInput={(event) => setChannel(event.currentTarget.value)}
                    disabled={busy()}
                    style={styles.field}
                  />

                  <Show when={mode() === "video"}>
                    <Input
                      label="MJPEG stream URL"
                      type="url"
                      name="streamUrl"
                      placeholder="http://192.168.1.20:8080/stream.mjpg"
                      value={streamUrl()}
                      onInput={(event) => setStreamUrl(event.currentTarget.value)}
                      disabled={busy()}
                      style={styles.field}
                    />
                    <Text variant="secondary" size="sm" style={styles.note}>
                      MJPEG only. The on-device decoder arrives in the next slice.
                    </Text>
                  </Show>

                  <Button type="submit" variant="primary" loading={busy()} disabled={busy()}>
                    Apply
                  </Button>
                </form>

                <Show when={frame()}>
                  {(current) => (
                    <Text variant="secondary" size="sm">
                      {new Date(current().updatedAt).getTime() === 0
                        ? "Using defaults"
                        : `Last set ${new Date(current().updatedAt).toLocaleString()}`}
                    </Text>
                  )}
                </Show>
              </>
            )}
          </Show>
        </Show>
      </div>
    </PageLayout>
  );
}

function SignIn(props: { busy: boolean; error: string | null; onSignIn: () => void }) {
  return (
    <div {...stylex.attrs(styles.panel)}>
      <Text>
        Sign in with GitHub to switch the frame between the are.na deck, the clock, and video mode.
      </Text>
      <Show when={props.error}>
        {(message) => <Banner variant="error" description={message()} />}
      </Show>
      <Button
        type="button"
        variant="primary"
        loading={props.busy}
        disabled={props.busy}
        onClick={props.onSignIn}
      >
        Sign in with GitHub
      </Button>
    </div>
  );
}
