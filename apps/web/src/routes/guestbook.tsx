import { useQuery, useMutation } from "@tanstack/solid-query";
import { For, Show, Loading, createSignal } from "solid-js";
import { PageLayout } from "@tom/ui/PageLayout";
import { Loader } from "@tom/ui/loader";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Banner } from "@tom/ui/banner";
import { Text } from "@tom/ui/text";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { callAdapter, unwrapAdapter } from "~/libs/adapter";
import { queryClient } from "~/libs/query-client";

export const fetchEntries = async () => {
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

const signGuestbook = async (message: string) => {
  const result = await callAdapter().guestbook.sign.post({ message });
  return unwrapAdapter(result);
};

const logout = async () => {
  const result = await callAdapter().guestbook.logout.post();
  return unwrapAdapter(result);
};

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

  const authMutation = useMutation(() => ({
    mutationFn: (inputHandle: string) => initiateAuth(inputHandle),
    onSuccess: (result) => {
      if (!result.authUrl.startsWith("https://")) throw new Error("Invalid auth URL");
      window.location.href = result.authUrl;
    },
  }));

  const signMutation = useMutation(() => ({
    mutationFn: (inputMessage: string) => signGuestbook(inputMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] });
      setMessage("");
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
          <Loading fallback={<Loader />}>
            <Show
              when={currentUserQuery.data}
              fallback={
                <div class="mb-8">
                  <Text class="mb-4">
                    Sign in with your Fediverse account (Mastodon, Pleroma, etc.) to leave a
                    message.
                  </Text>
                  <Text variant="secondary" size="sm" class="mb-3">
                    Enter your full Fediverse handle (e.g., user@mastodon.social or
                    user@fosstodon.org).
                  </Text>
                  <Show when={authMutation.isError}>
                    <Banner
                      variant="error"
                      description={authMutation.error?.message}
                      class="mb-4"
                    />
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
                      <Input
                        type="text"
                        name="handle"
                        placeholder="user@mastodon.social"
                        value={handle()}
                        onInput={(e) => {
                          setHandle(e.currentTarget.value);
                        }}
                        required
                        pattern="[^@]+@[^@]+"
                        title="Enter your Fediverse handle in the format: user@instance.social"
                        disabled={authMutation.isPending}
                        class="flex-1"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        loading={authMutation.isPending}
                        disabled={authMutation.isPending}
                      >
                        {authMutation.isPending ? "Connecting..." : "Sign in"}
                      </Button>
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
                          <Text bold as="span" class="block">
                            {u.display_name}
                          </Text>
                          <Text variant="secondary" size="sm" as="span" class="block">
                            @{u.username}@{u.instance}
                          </Text>
                        </div>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          logoutMutation.mutate();
                        }}
                      >
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          loading={logoutMutation.isPending}
                          disabled={logoutMutation.isPending}
                        >
                          {logoutMutation.isPending ? "Logging out..." : "Logout"}
                        </Button>
                      </form>
                    </div>
                    <Show when={signMutation.isSuccess}>
                      <Banner
                        variant="default"
                        description="Thank you for signing the guestbook!"
                        class="mb-4"
                      />
                    </Show>
                    <Show when={signMutation.isError}>
                      <Banner
                        variant="error"
                        description={signMutation.error?.message}
                        class="mb-4"
                      />
                    </Show>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const inputMessage = formData.get("message")?.toString();
                        if (inputMessage) signMutation.mutate(inputMessage);
                      }}
                    >
                      <textarea
                        name="message"
                        placeholder="Leave your message here..."
                        value={message()}
                        onInput={(e) => {
                          setMessage(e.currentTarget.value);
                        }}
                        required
                        maxlength={500}
                        disabled={signMutation.isPending}
                        class="mb-2 min-h-32 w-full rounded-lg border border-tomui-line bg-tomui-control px-3 py-2 text-tomui-default outline-none focus:border-tomui-focus"
                      />
                      <div class="flex justify-between items-center">
                        <Text variant="secondary" size="sm" as="span">
                          {message().length}/500
                        </Text>
                        <Button
                          type="submit"
                          variant="primary"
                          loading={signMutation.isPending}
                          disabled={signMutation.isPending}
                        >
                          {signMutation.isPending ? "Signing..." : "Sign guestbook"}
                        </Button>
                      </div>
                    </form>
                  </div>
                );
              }}
            </Show>
          </Loading>
        </div>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <div class="space-y-4">
          <Text variant="heading" as="h2" class="mb-4">
            Signatures
          </Text>
          <Loading fallback={<Loader />}>
            <Show when={entriesQuery.data}>
              {(data) => {
                const d = data();
                return (
                  <Show
                    when={d.length > 0}
                    fallback={
                      <Text variant="secondary" size="sm">
                        No signatures yet. Be the first!
                      </Text>
                    }
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
                                <Text bold as="span">
                                  {entry.display_name ?? entry.fediverse_username}
                                </Text>
                                <Text variant="secondary" size="sm" as="span">
                                  {entry.fediverse_username}
                                </Text>
                              </div>
                              <Text class="guestbook-message mb-2">{entry.message}</Text>
                              <Text variant="secondary" size="xs" as="time">
                                {new Date(entry.created_at).toLocaleDateString("en-NZ", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                );
              }}
            </Show>
          </Loading>
        </div>
      </BlurInSection>
    </PageLayout>
  );
}
