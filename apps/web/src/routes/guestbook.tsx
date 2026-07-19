import { createAsync, useSubmission, type RouteDefinition } from "@solidjs/router";
import { For, Show, Suspense, createSignal } from "solid-js";
import { PageLayout } from "~/layouts";
import { Spinner, BlurInSection, BlurInText } from "~/components";
import {
  getEntries,
  getCurrentUser,
  initiateAuthAction,
  logoutAction,
  signGuestbookAction,
} from "~/libs/actions/guestbook";

export const route = {
  preload: () => {
    getEntries();
    getCurrentUser();
  },
} satisfies RouteDefinition;

export default function Guestbook() {
  const entries = createAsync(() => getEntries());
  const currentUser = createAsync(() => getCurrentUser());
  const [message, setMessage] = createSignal("");
  const [handle, setHandle] = createSignal("");
  const authSubmission = useSubmission(initiateAuthAction);
  const signSubmission = useSubmission(signGuestbookAction);
  const logoutSubmission = useSubmission(logoutAction);

  return (
    <PageLayout title="Guestbook" description="Sign my guestbook">
      <BlurInText text="Guestbook" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <div class="mx-auto">
          <Suspense fallback={<Spinner />}>
            <Show
              when={currentUser()}
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
                  <Show when={authSubmission.error}>
                    <div class="mb-4 alert-error">{authSubmission.error.message}</div>
                  </Show>
                  <form action={initiateAuthAction} method="post">
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
                        disabled={authSubmission.pending}
                        class="input flex-1"
                      />
                      <button
                        type="submit"
                        disabled={authSubmission.pending}
                        class="button-primary"
                      >
                        {authSubmission.pending ? "Connecting..." : "Sign in"}
                      </button>
                    </div>
                  </form>
                </div>
              }
            >
              {(user) => (
                <div class="mb-8">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <img
                        src={user().avatar_url}
                        alt={user().display_name}
                        class="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div class="font-semibold">{user().display_name}</div>
                        <div class="text-sm text-muted">
                          @{user().username}@{user().instance}
                        </div>
                      </div>
                    </div>
                    <form action={logoutAction} method="post">
                      <button
                        type="submit"
                        disabled={logoutSubmission.pending}
                        class="button-secondary"
                      >
                        {logoutSubmission.pending ? "Logging out..." : "Logout"}
                      </button>
                    </form>
                  </div>
                  <Show when={signSubmission.result?.success}>
                    <div class="mb-4 alert-success">Thank you for signing the guestbook!</div>
                  </Show>
                  <Show when={signSubmission.error}>
                    <div class="mb-4 alert-error">{signSubmission.error.message}</div>
                  </Show>
                  <form action={signGuestbookAction} method="post">
                    <textarea
                      name="message"
                      placeholder="Leave your message here..."
                      value={message()}
                      onInput={(e) => setMessage(e.currentTarget.value)}
                      required
                      maxLength={500}
                      disabled={signSubmission.pending}
                      class="input w-full min-h-32 mb-2"
                    />
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-muted">{message().length}/500</span>
                      <button
                        type="submit"
                        disabled={signSubmission.pending}
                        class="button-primary"
                      >
                        {signSubmission.pending ? "Signing..." : "Sign guestbook"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </Show>
          </Suspense>
        </div>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <div class="space-y-4">
          <h2 class="mb-4">Signatures</h2>
          <Suspense fallback={<Spinner />}>
            <Show
              when={entries() && entries()!.length > 0}
              fallback={<div class="text-muted">No signatures yet. Be the first!</div>}
            >
              <For each={entries()}>
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
          </Suspense>
        </div>
      </BlurInSection>
    </PageLayout>
  );
}
