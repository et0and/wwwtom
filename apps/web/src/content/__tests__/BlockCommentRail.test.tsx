import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/solid-query";
import { BlockCommentRail } from "~/content/BlockCommentRail";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";
import { queryClient } from "~/data/query-client";

const fetchMock = stubAdapterFetch();

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockReset();
});

const commentsPage = (data: ReadonlyArray<unknown>) => ({
  meta: {
    current_page: 1,
    per_page: 24,
    total_pages: 1,
    total_count: data.length,
    has_more_pages: false,
  },
  data,
});

const comment = (id: number, name: string, userId: number, text: string) => ({
  id,
  type: "Comment",
  body: { markdown: text, html: `<p>${text}</p>`, plain: text },
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  user: { id: userId, type: "User", name, slug: "someone", avatar: null, initials: "SO" },
  _links: {},
});

type Handler = () => Response;

/** Match adapter requests by method + pathname, whatever shape fetch gets. */
const route = (handlers: ReadonlyArray<readonly [string, string, Handler]>): void => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const match = handlers.find(
      ([method, pathname]) => method === request.method && pathname === url.pathname,
    );
    return match ? match[2]() : jsonResponse({ message: "Not found" }, 404);
  });
};

const renderRail = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <BlockCommentRail blockId={101} onClose={() => {}} />
    </QueryClientProvider>
  ));

const SIGNED_IN = () => jsonResponse({ id: 42, name: "Tom", slug: "tom", avatarUrl: null });

describe("BlockCommentRail", () => {
  it("shows the thread and a sign-in CTA when signed out", async () => {
    route([
      ["GET", "/arena/me", () => jsonResponse(null)],
      [
        "GET",
        "/arena/blocks/101/comments",
        () => jsonResponse(commentsPage([comment(5, "Ada", 7, "Lovely")])),
      ],
    ]);

    renderRail();

    expect(await screen.findByText("Lovely")).toBeTruthy();
    expect(screen.getByText("Sign in with are.na to comment")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("posts a comment as the signed-in user", async () => {
    let posted = 0;
    route([
      ["GET", "/arena/me", SIGNED_IN],
      ["GET", "/arena/blocks/101/comments", () => jsonResponse(commentsPage([]))],
      [
        "POST",
        "/arena/blocks/101/comments",
        () => {
          posted += 1;
          return jsonResponse(comment(9, "Tom", 42, "Nice one"));
        },
      ],
    ]);

    renderRail();

    const textarea = await screen.findByPlaceholderText("Add a comment...");
    await userEvent.type(textarea, "Nice one");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(posted).toBe(1));
  });

  it("offers Delete only on your own comment", async () => {
    let deleted = 0;
    route([
      ["GET", "/arena/me", SIGNED_IN],
      [
        "GET",
        "/arena/blocks/101/comments",
        () =>
          jsonResponse(
            commentsPage([comment(5, "Tom", 42, "Mine"), comment(6, "Ada", 7, "Theirs")]),
          ),
      ],
      [
        "DELETE",
        "/arena/comments/5",
        () => {
          deleted += 1;
          return jsonResponse({ success: true });
        },
      ],
    ]);

    renderRail();

    // One Delete button, for the comment the signed-in user wrote.
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    expect(buttons).toHaveLength(1);

    await userEvent.click(buttons[0]!);
    await waitFor(() => expect(deleted).toBe(1));
  });
});
