import type { RouteDefinition } from "@solidjs/router";
import { useQuery, useMutation } from "@tanstack/solid-query";
import { For, Show, Suspense, createSignal } from "solid-js";
import { PageLayout } from "@tom/ui/PageLayout";
import { Spinner } from "@tom/ui/Spinner";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { Turnstile, getTurnstileSitekey } from "~/components/Turnstile";
import { callAdapter, unwrapAdapter } from "~/libs/adapter";
import { queryClient } from "~/libs/query-client";

const fetchEntries = async () => {
  const result = await callAdapter().guestbook.entries.get();
  return unwrapAdapter(result);
};

// The guestbook user lives in an adapter-domain cookie, so this must run in
// the browser (client-only) — never preloaded server-side.
const fetchCurrentUser = async () => {
  const result = await callAdapter().guestbook.me.get();
  return unwrapAdapter(result);
};

const initiateAuth = async (handle: string) => {
  const result = await callAdapter().guestbook.auth.initiate.post({ handle });
  return unwrapAdapter(result);
};

const signGuestbook = async (message: string, token?: string) => {
  const result = await callAdapter().guestbook.sign.post({ message, token });
  return unwrapAdapter(result);
};

const logout = async () => {
  const result = await callAdapter().guestbook.logout.post();
  return unwrapAdapter(result);
};

export const route = {
  preload: () => {
    queryClient
      .prefetchQuery({
        queryKey: ["guestbook-entries"],
        queryFn: fetchEntries,
      })
      .catch(() => {
        // A failed prefetch surfaces through the query's error state — don't
        // let the rejection fail the SSR request.
      });
  },
} satisfies RouteDefinition;

export default function Guestbook() {
  const entriesQuery = useQuery(() => ({
    queryKey: ["guestbook-entries"],
    queryFn: fetchEntries,
  }));

  const currentUserQuery = useQuery(() => ({
    queryKey: ["guestbook-current-user"],
    queryFn: fetchCurrentUser,
  }));

  const [message, setMessage] = createSignal("");
  const [handle, setHandle] = createSignal("");
  const [turnstileToken, setTurnstileToken] = createSignal<string>();
  const [turnstileAttempt, setTurnstileAttempt] = createSignal(0);
  const [verificationError, setVerificationError] = createSignal("");
  const turnstileSitekey = getTurnstileSitekey();

  const authMutation = useMutation(() => ({
    mutationFn: (inputHandle: string) => initiateAuth(inputHandle),
    onSuccess: (result) => {
      window.location.href = result.authUrl;
    },
  }));

  const signMutation = useMutation(() => ({
    mutationFn: (input: { message: string; token?: string | undefined }) =>
      signGuestbook(input.message, input.token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] });
      setMessage("");
    },
    onSettled: () => {
      // Tokens are single-use (redeemed at siteverify) — render a fresh
      // widget after every attempt.
      setTurnstileAttempt((attempt) => attempt + 1);
      setTurnstileToken(undefined);
    },
  }));

  const logoutMutation = useMutation(() => ({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guestbook-current-user"] });
      queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] });
    },
  }));

  return (
    <PageLayout title="Guestbook" description="Sign my guestbook">
      <BlurInText text="Guestbook" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <div class="mx-auto">
          <Suspense fallback={<Spinner />}>
            <Show
              when={currentUserQuery.data}
              fallback={
                <div class="mb-8">
                  <p class="mb-4">
                    Sign in with your Fediverse account (Mastodon, Pleroma, etc.) to leave a
                    message.
                  </p>
                  <p class="mb-3 text-sm">
                    Enter your full Fediverse handle (e.g., user@mastodon.social or
                    user@fosstodon.org).
                  </p>
                  <Show when={authMutation.isError}>
                    <div class="mb-4 alert-error">{authMutation.error?.message}</div>
                  </Show>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const inputHandle = formData.get("handle")?.toString();
                      if (inputHandle) authMutation.mutate(inputHandle);
                    }}
                  >
                    <div class="flex gap-2">
                      <input
                        type="text"
                        name="handle"
                        placeholder="user@mastodon.social"
                        value={handle()}
                        onInput={(e) => setHandle(e.currentTarget.value)}
                        required
                        pattern="[^@]+@[^@]+"
                        title="Enter your Fediverse handle in the format: user@instance.social"
                        disabled={authMutation.isPending}
                        class="input flex-1"
                      />
                      <button
                        type="submit"
                        disabled={authMutation.isPending}
                        class="button-primary"
                      >
                        {authMutation.isPending ? "Connecting..." : "Sign in"}
                      </button>
                    </div>
                  </form>
                </div>
              }
            >
              {(user) => {
                const u = user();
                return (
                  <div class="mb-8">
                    <div class="flex items-center justify-between mb-4">
                      <div class="flex items-center gap-3">
                        <img
                          src={u.avatar_url}
                          alt={u.display_name}
                          class="w-12 h-12 rounded-full"
                        />
                        <div>
                          <div class="font-semibold">{u.display_name}</div>
                          <div class="text-sm text-muted">
                            @{u.username}@{u.instance}
                          </div>
                        </div>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          logoutMutation.mutate();
                        }}
                      >
                        <button
                          type="submit"
                          disabled={logoutMutation.isPending}
                          class="button-secondary"
                        >
                          {logoutMutation.isPending ? "Logging out..." : "Logout"}
                        </button>
                      </form>
                    </div>
                    <Show when={signMutation.isSuccess}>
                      <div class="mb-4 alert-success">Thank you for signing the guestbook!</div>
                    </Show>
                    <Show when={signMutation.isError}>
                      <div class="mb-4 alert-error">{signMutation.error?.message}</div>
                    </Show>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const inputMessage = formData.get("message")?.toString();
                        if (!inputMessage) return;
                        const token = turnstileToken();
                        if (turnstileSitekey && !token) {
                          setVerificationError("Complete the verification to sign the guestbook.");
                          return;
                        }
                        setVerificationError("");
                        signMutation.mutate({ message: inputMessage, token });
                      }}
                    >
                      <textarea
                        name="message"
                        placeholder="Leave your message here..."
                        value={message()}
                        onInput={(e) => setMessage(e.currentTarget.value)}
                        required
                        maxLength={500}
                        disabled={signMutation.isPending}
                        class="input w-full min-h-32 mb-2"
                      />
                      <Show when={turnstileSitekey}>
                        <div class="mb-2">
                          <Turnstile
                            action="guestbook-sign"
                            attempt={turnstileAttempt()}
                            onToken={setTurnstileToken}
                            onExpire={() => setTurnstileToken(undefined)}
                          />
                        </div>
                      </Show>
                      <Show when={verificationError()}>
                        <div class="mb-2 text-sm alert-error">{verificationError()}</div>
                      </Show>
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-muted">{message().length}/500</span>
                        <button
                          type="submit"
                          disabled={signMutation.isPending}
                          class="button-primary"
                        >
                          {signMutation.isPending ? "Signing..." : "Sign guestbook"}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              }}
            </Show>
          </Suspense>
        </div>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <div class="space-y-4">
          <h2 class="mb-4">Signatures</h2>
          <Suspense fallback={<Spinner />}>
            <Show when={entriesQuery.data}>
              {(data) => {
                const d = data();
                return (
                  <Show
                    when={d.length > 0}
                    fallback={<div class="text-muted">No signatures yet. Be the first!</div>}
                  >
                    <For each={d}>
                      {(entry) => (
                        <div class="guestbook-entry">
                          <div class="flex items-start gap-3">
                            <Show when={entry.avatar_url}>
                              <img
                                src={entry.avatar_url!}
                                alt={entry.display_name ?? entry.fediverse_username}
                                class="w-10 h-10 rounded-full"
                              />
                            </Show>
                            <div class="flex-1">
                              <div class="flex items-baseline gap-2 mb-1">
                                <span class="font-semibold">
                                  {entry.display_name ?? entry.fediverse_username}
                                </span>
                                <span class="text-sm text-muted">{entry.fediverse_username}</span>
                              </div>
                              <p class="guestbook-message mb-2">{entry.message}</p>
                              <time class="text-xs text-subtle">
                                {new Date(entry.created_at).toLocaleDateString("en-NZ", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                );
              }}
            </Show>
          </Suspense>
        </div>
      </BlurInSection>
    </PageLayout>
  );
}
