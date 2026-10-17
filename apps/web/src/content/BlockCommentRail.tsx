import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/solid-query";
import { For, Loading, Show, createSignal } from "solid-js";
import { isServer } from "@solidjs/web";
import { colors } from "@tom/ui/colors.stylex";
import { radius } from "@tom/ui/primitives.stylex";
import { textColors } from "@tom/ui/tokens.stylex";
import { Button } from "@tom/ui/button";
import { Loader } from "@tom/ui/loader";
import { Text } from "@tom/ui/text";
import { formatDateTime } from "@tom/utils/date";
import { callAdapter, runAdapterCall } from "~/data/adapter";
import { queryClient } from "~/data/query-client";

const WIDE = "@media (min-width: 900px)";

const styles = stylex.create({
  rail: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    maxHeight: "70vh",
    overflowY: "auto",
    padding: "1rem",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors["--color-tomui-line"],
    backgroundColor: colors["--color-tomui-canvas"],
    [WIDE]: {
      top: "5rem",
      left: "auto",
      bottom: "auto",
      width: "20rem",
      maxHeight: "calc(100vh - 6rem)",
      borderTopWidth: 0,
      borderLeftWidth: "1px",
      borderLeftStyle: "solid",
      borderLeftColor: colors["--color-tomui-line"],
    },
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
  },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  comment: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  commentHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "0.5rem",
  },
  composer: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  textarea: {
    minHeight: "4.5rem",
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
});

// The are.na session lives in an adapter-domain cookie, so these must run in
// the browser — never preloaded server-side.
const fetchBlockComments = (blockId: number) =>
  runAdapterCall(() => callAdapter().arena.blocks({ id: blockId }).comments.get());

const postBlockComment = (blockId: number, body: string) =>
  runAdapterCall(() => callAdapter().arena.blocks({ id: blockId }).comments.post({ body }));

const deleteBlockComment = (commentId: number) =>
  runAdapterCall(() => callAdapter().arena.comments({ id: commentId }).delete());

const fetchArenaAccount = () => runAdapterCall(() => callAdapter().arena.me.get());

const startArenaAuth = () => runAdapterCall(() => callAdapter().arena.auth.initiate.post());

/**
 * A slim rail for one block's are.na thread. Reads are public; writing needs
 * the signed-in are.na account, so a signed-out reader gets a CTA instead of
 * the composer. Comments are are.na's, and only your own can be deleted.
 */
export function BlockCommentRail(props: { blockId: number; onClose: () => void }) {
  const commentsQuery = useQuery(() => ({
    queryKey: ["arena-block-comments", props.blockId],
    queryFn: () => fetchBlockComments(props.blockId),
    enabled: !isServer,
  }));

  const accountQuery = useQuery(() => ({
    queryKey: ["arena-account"],
    queryFn: fetchArenaAccount,
    enabled: !isServer,
  }));

  const [draft, setDraft] = createSignal("");

  const invalidateComments = () =>
    queryClient.invalidateQueries({ queryKey: ["arena-block-comments", props.blockId] });

  const postMutation = useMutation(() => ({
    mutationFn: (body: string) => postBlockComment(props.blockId, body),
    onSuccess: () => {
      invalidateComments();
      setDraft("");
    },
  }));

  const deleteMutation = useMutation(() => ({
    mutationFn: (commentId: number) => deleteBlockComment(commentId),
    onSuccess: invalidateComments,
  }));

  const authMutation = useMutation(() => ({
    mutationFn: () => startArenaAuth(),
    onSuccess: (result) => {
      if (!result.authUrl.startsWith("https://")) throw new Error("Invalid auth URL");
      window.location.href = result.authUrl;
    },
  }));

  const accountId = () => accountQuery.data?.id;

  return (
    <aside aria-label="Block comments" {...stylex.attrs(styles.rail)}>
      <div {...stylex.attrs(styles.header)}>
        <Text variant="heading" size="sm" as="h2">
          Comments
        </Text>
        <Button type="button" variant="secondary" size="sm" onClick={() => props.onClose()}>
          Close
        </Button>
      </div>

      <Loading fallback={<Loader />}>
        <Show when={commentsQuery.data} keyed>
          {(page) => (
            <Show
              when={page.data.length > 0}
              fallback={
                <Text variant="secondary" size="sm">
                  No comments yet.
                </Text>
              }
            >
              <div {...stylex.attrs(styles.list)}>
                <For each={page.data}>
                  {(comment) => (
                    <div {...stylex.attrs(styles.comment)}>
                      <div {...stylex.attrs(styles.commentHeader)}>
                        <Text bold size="sm" as="span">
                          {comment.user.name}
                        </Text>
                        <Text variant="secondary" size="xs" as="time">
                          {formatDateTime(comment.created_at)}
                        </Text>
                      </div>
                      <Show when={comment.body?.plain}>
                        {(plain) => <Text size="sm">{plain()}</Text>}
                      </Show>
                      <Show when={accountId() !== undefined && comment.user.id === accountId()}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(comment.id)}
                        >
                          Delete
                        </Button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          )}
        </Show>
      </Loading>

      <Show
        when={accountQuery.data}
        fallback={
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={authMutation.isPending}
            disabled={authMutation.isPending}
            onClick={() => authMutation.mutate()}
          >
            Sign in with are.na to comment
          </Button>
        }
      >
        <form
          {...stylex.attrs(styles.composer)}
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft().trim();
            if (value !== "") postMutation.mutate(value);
          }}
        >
          <textarea
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            placeholder="Add a comment..."
            maxlength={500}
            disabled={postMutation.isPending}
            {...stylex.attrs(styles.textarea)}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={postMutation.isPending}
            disabled={postMutation.isPending || draft().trim() === ""}
          >
            Comment
          </Button>
        </form>
      </Show>

      <Show when={postMutation.isError}>
        <Text variant="secondary" size="sm">
          {postMutation.error?.message}
        </Text>
      </Show>
    </aside>
  );
}
