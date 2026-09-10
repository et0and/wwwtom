import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { createRouter, memoryHistory } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { HttpError } from "@tom/types/errors";
import PostPage from "~/routes/posts/[slug]";

vi.mock("~/server/adapter", () => ({
  fetchPostBySlug: vi.fn(),
}));

import { fetchPostBySlug } from "~/server/adapter";

const mockedFetchPostBySlug = fetchPostBySlug as Mock;

const postData = {
  id: "post-1",
  title: "A pattern language",
  summary: "On imagining a monorepo as a shared house",
  slug: "a-pattern-language",
  publishedAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  meta: { description: "A meta description" },
  html: "<p>On imagining a monorepo as a shared house.</p>",
  arenaBlocks: [],
};

const TestRouter = createRouter({
  history: memoryHistory("/posts/a-pattern-language"),
  routes: [{ path: "/posts/:slug", component: PostPage }],
});

const renderPostPage = () => {
  // Fresh client per test: no shared cache between cases, and no retries so
  // error states settle within the default waitFor timeout.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>
      <TestRouter />
    </QueryClientProvider>
  ));
};

const headMeta = (selector: string): string | null | undefined =>
  document.head.querySelector(selector)?.getAttribute("content");

beforeEach(() => {
  mockedFetchPostBySlug.mockReset();
});

describe("post page meta tags", () => {
  it("renders title, description and og/twitter meta into the document head", async () => {
    mockedFetchPostBySlug.mockResolvedValue(postData);
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
    mockedFetchPostBySlug.mockResolvedValue(postData);
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
    const bare = { ...postData, html: "", arenaBlocks: [] };
    mockedFetchPostBySlug.mockResolvedValue(bare);
    renderPostPage();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());

    expect(headMeta('meta[property="og:title"]')).toBe("A pattern language | Tom Hackshaw");
  });

  it("shows a spinner — not Not found — while the post is loading", async () => {
    mockedFetchPostBySlug.mockReturnValue(new Promise(() => {}));
    renderPostPage();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.queryByText("Not found")).toBeNull();
  });

  it("shows Not found once a missing slug settles to null", async () => {
    mockedFetchPostBySlug.mockResolvedValue(null);
    renderPostPage();
    await waitFor(() => expect(screen.getByText("Not found")).toBeTruthy());
    expect(screen.getByText('The post "a-pattern-language" does not exist.')).toBeTruthy();
    expect(document.head.querySelector("title")?.textContent).toBe("Not found | Tom Hackshaw");
  });

  it("shows an error banner — not Not found — on a server error", async () => {
    mockedFetchPostBySlug.mockRejectedValue(
      new HttpError({ message: "Adapter request failed", status: 500 }),
    );
    renderPostPage();
    await waitFor(() => expect(screen.getByText("Error loading post")).toBeTruthy());
    expect(screen.queryByText("Not found")).toBeNull();
    expect(document.head.querySelector("title")?.textContent).toBe("Error | Tom Hackshaw");
  });
});
