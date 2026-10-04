import * as stylex from "@stylexjs/stylex";
import { useQuery, useMutation } from "@tanstack/solid-query";
import { For, Show, Loading, createSignal } from "solid-js";
import { isServer } from "@solidjs/web";
import { colors } from "@tom/ui/colors.stylex";
import { PageLayout } from "@tom/ui/PageLayout";
import { Loader } from "@tom/ui/loader";
import { radius } from "@tom/ui/primitives.stylex";
import { textColors } from "@tom/ui/tokens.stylex";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Banner } from "@tom/ui/banner";
import { Text } from "@tom/ui/text";
import { callAdapter, runAdapterCall } from "~/libs/adapter";
import { queryClient } from "~/libs/query-client";
import { formatDateTime } from "@tom/utils/date";
import { bannerTitleStyles, layoutStyles } from "../components/layout.stylex";

const styles = stylex.create({
  sectionSpacing: { marginBottom: "1rem" },
  mxAuto: { marginInline: "auto" },
  signInSection: { marginBottom: "2rem" },
  handleRow: { display: "flex", gap: "0.5rem" },
  handleInput: { flex: "1 1 0%" },
  userRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  userInfo: { display: "flex", alignItems: "center", gap: "0.75rem" },
  avatar: {
    width: "3rem",
    height: "3rem",
    borderRadius: radius.full.borderRadius,
  },
  signaturesSection: { display: "flex", flexDirection: "column", gap: "1rem" },
  entryAvatar: {
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: radius.full.borderRadius,
  },
  entryRow: { display: "flex", alignItems: "flex-start", gap: "0.75rem" },
  entryBody: { flex: "1 1 0%" },
  entryHeader: { display: "flex", alignItems: "baseline", gap: "0.5rem" },
  messageTextarea: {
    marginBottom: "0.5rem",
    minHeight: "8rem",
    width: "100%",
    borderRadius: radius.lg.borderRadius,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors["--color-tomui-line"],
    backgroundColor: colors["--color-tomui-control"],
    color: textColors["--text-color-tomui-default"],
    outlineStyle: "none",
    paddingInline: "0.75rem",
    paddingBlock: "0.5rem",
    ":focus": { borderColor: colors["--color-tomui-focus"] },
  },
  messageFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
});

export const fetchEntries = () => runAdapterCall(() => callAdapter().guestbook.entries.get());

// The guestbook user lives in an adapter-domain cookie, so this must run in
// the browser (client-only) — never preloaded server-side.
const fetchCurrentUser = () => runAdapterCall(() => callAdapter().guestbook.me.get());

const initiateAuth = (handle: string) =>
  runAdapterCall(() => callAdapter().guestbook.auth.initiate.post({ handle }));

const signGuestbook = (message: string) =>
  runAdapterCall(() => callAdapter().guestbook.sign.post({ message }));

const logout = () => runAdapterCall(() => callAdapter().guestbook.logout.post());

export default function Guestbook() {
  const entriesQuery = useQuery(() => ({
    queryKey: ["guestbook-entries"],
    queryFn: fetchEntries,
  }));

  const currentUserQuery = useQuery(() => ({
    queryKey: ["guestbook-current-user"],
    queryFn: fetchCurrentUser,
    enabled: !isServer,
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
      <Text variant="heading" size="lg" as="h1">
        Guestbook
      </Text>
      <div>
        <div {...stylex.attrs(styles.mxAuto)}>
          <Loading fallback={<Loader />}>
            <Show
              when={currentUserQuery.data}
              fallback={
                <div {...stylex.attrs(styles.signInSection)}>
                  <Text style={layoutStyles.mb4}>
                    Sign in with your Fediverse account (Mastodon, Pleroma, etc.) to leave a
                    message.
                  </Text>
                  <Text variant="secondary" size="sm" style={layoutStyles.mb3}>
                    Enter your full Fediverse handle (e.g., user@mastodon.social or
                    user@fosstodon.org).
                  </Text>
                  <Show when={authMutation.isError}>
                    <Banner
                      variant="error"
                      description={authMutation.error?.message}
                      style={styles.sectionSpacing}
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
                    <div {...stylex.attrs(styles.handleRow)}>
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
                        style={styles.handleInput}
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
                  <div {...stylex.attrs(styles.signInSection)}>
                    <div {...stylex.attrs(styles.userRow, layoutStyles.mb4)}>
                      <div {...stylex.attrs(styles.userInfo)}>
                        <img
                          src={u.avatar_url}
                          alt={u.display_name}
                          {...stylex.attrs(styles.avatar)}
                        />
                        <div>
                          <Text bold as="span" style={layoutStyles.block}>
                            {u.display_name}
                          </Text>
                          <Text variant="secondary" size="sm" as="span" style={layoutStyles.block}>
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
                        style={styles.sectionSpacing}
                      />
                    </Show>
                    <Show when={signMutation.isError}>
                      <Banner
                        variant="error"
                        description={signMutation.error?.message}
                        style={styles.sectionSpacing}
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
                        {...stylex.attrs(styles.messageTextarea)}
                      />
                      <div {...stylex.attrs(styles.messageFooter)}>
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
      </div>
      <div>
        <div {...stylex.attrs(styles.signaturesSection)}>
          <Text variant="heading" as="h2">
            Signatures
          </Text>
          <Loading fallback={<Loader />}>
            {/* keyed: a signed entry replaces the data array without toggling
                truthiness, which a non-keyed Show would not re-render. */}
            <Show when={entriesQuery.data} keyed>
              {(entries) => (
                <Show
                  when={entries.length > 0}
                  fallback={
                    <Text variant="secondary" size="sm">
                      No signatures yet. Be the first!
                    </Text>
                  }
                >
                  <For each={entries}>
                    {(entry) => (
                      <div class="guestbook-entry">
                        <div {...stylex.attrs(styles.entryRow)}>
                          <Show when={entry.avatar_url}>
                            <img
                              src={entry.avatar_url!}
                              alt={entry.display_name ?? entry.fediverse_username}
                              {...stylex.attrs(styles.entryAvatar)}
                            />
                          </Show>
                          <div {...stylex.attrs(styles.entryBody)}>
                            <div {...stylex.attrs(styles.entryHeader, layoutStyles.mb1)}>
                              <Text bold as="span">
                                {entry.display_name ?? entry.fediverse_username}
                              </Text>
                              <Text variant="secondary" size="sm" as="span">
                                {entry.fediverse_username}
                              </Text>
                            </div>
                            <Text style={[bannerTitleStyles.guestbookMessage, layoutStyles.mb2]}>
                              {entry.message}
                            </Text>
                            <Text variant="secondary" size="xs" as="time">
                              {formatDateTime(entry.created_at)}
                            </Text>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
              )}
            </Show>
          </Loading>
        </div>
      </div>
    </PageLayout>
  );
}
