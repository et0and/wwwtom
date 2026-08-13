import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { MetaProvider } from "@solidjs/meta";
import { queryClient } from "~/libs/query-client";
import PostPage from "~/routes/posts/[slug]";

vi.mock("~/server/adapter", () => ({
  fetchPostBySlug: vi.fn(),
}));

import { fetchPostBySlug } from "~/server/adapter";

const mockedFetchPostBySlug = fetchPostBySlug as Mock;

const postPayload = {
  id: "34",
  title: "A pattern language",
  summary: "On imagining a monorepo as a shared house",
  slug: "a-pattern-language",
  publishedAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  meta: { description: "A meta description" },
  content: "<p>On imagining a monorepo as a shared house.</p>",
  arenaBlocks: [],
};

const renderPostPage = () => {
  const history = createMemoryHistory();
  history.set({ value: "/posts/a-pattern-language" });
  return render(() => (
    <MetaProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter history={history}>
          <Route path="/posts/:slug" component={PostPage} />
        </MemoryRouter>
      </QueryClientProvider>
    </MetaProvider>
  ));
};

const headMeta = (selector: string): string | null | undefined =>
  document.head.querySelector(selector)?.getAttribute("content");

beforeEach(() => {
  queryClient.clear();
  mockedFetchPostBySlug.mockReset();
});

describe("post page meta tags", () => {
  it("renders title, description and og/twitter meta into the document head", async () => {
    mockedFetchPostBySlug.mockResolvedValue(postPayload);
    renderPostPage();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());

    expect(document.head.querySelector("title")?.textContent).toBe(
      "A pattern language | Tom Hackshaw",
    );
    expect(headMeta('meta[name="description"]')).toBe("On imagining a monorepo as a shared house");
    expect(headMeta('meta[property="og:title"]')).toBe("A pattern language | Tom Hackshaw");
    expect(headMeta('meta[property="og:description"]')).toBe(
      "On imagining a monorepo as a shared house",
    );
    expect(headMeta('meta[name="twitter:title"]')).toBe("A pattern language | Tom Hackshaw");
    expect(headMeta('meta[name="twitter:description"]')).toBe(
      "On imagining a monorepo as a shared house",
    );
    expect(headMeta('meta[name="twitter:card"]')).toBe("summary_large_image");
  });

  it("points og:image and twitter:image at the public adapter proxy, absolute", async () => {
    mockedFetchPostBySlug.mockResolvedValue(postPayload);
    renderPostPage();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());

    const imageUrl =
      "https://adapter.tom.so/og?title=A%20pattern%20language" +
      "&summary=On%20imagining%20a%20monorepo%20as%20a%20shared%20house";

    expect(headMeta('meta[property="og:image"]')).toBe(imageUrl);
    expect(headMeta('meta[name="twitter:image"]')).toBe(imageUrl);
  });

  it("does not require the post content before resolving", async () => {
    // The meta tags must be present once the query settles, regardless of the
    // innerHTML body content — this guards against the head flushing before
    // the async post fetch resolves.
    const bare = { ...postPayload, content: "", arenaBlocks: [] };
    mockedFetchPostBySlug.mockResolvedValue(bare);
    renderPostPage();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());

    expect(headMeta('meta[property="og:title"]')).toBe("A pattern language | Tom Hackshaw");
  });
});
