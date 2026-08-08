import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { Router, Route } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { MetaProvider } from "@solidjs/meta";
import { queryClient } from "~/libs/query-client";
import PostsHome from "~/routes/posts/index";

vi.mock("~/server/adapter", () => ({
  fetchPosts: vi.fn(),
}));

import { fetchPosts } from "~/server/adapter";

// The fixtures are intentionally minimal; the server function's branded
// PayloadPost types are not what this UI test cares about.
const mockedFetchPosts = fetchPosts as Mock;

const postsPayload = {
  data: [
    {
      id: "34",
      title: "A pattern language",
      summary: "On imagining a monorepo as a shared house",
      slug: "a-pattern-language",
      publishedAt: "2026-06-30T00:00:00.000Z",
      meta: { description: "A meta description" },
    },
    {
      id: "35",
      title: "On git notes",
      summary: "Using a niche git feature",
      slug: "on-git-notes",
      publishedAt: "2026-05-28T00:00:00.000Z",
      meta: { description: "Another description" },
    },
  ],
  meta: {
    pagination: { page: 1, pageSize: 5, pageCount: 1, total: 2 },
  },
};

const renderPosts = () =>
  render(() => (
    <MetaProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Route path="/" component={PostsHome} />
        </Router>
      </QueryClientProvider>
    </MetaProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  mockedFetchPosts.mockReset();
});

describe("posts page", () => {
  it("renders posts fetched through the server function", async () => {
    mockedFetchPosts.mockResolvedValue(postsPayload);
    renderPosts();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());
    expect(screen.getByText("On git notes")).toBeTruthy();
    expect(screen.getByText("On imagining a monorepo as a shared house")).toBeTruthy();
    expect(mockedFetchPosts).toHaveBeenCalledWith(1, 5);
  });

  it("shows the error banner when the server function fails", async () => {
    mockedFetchPosts.mockRejectedValue(new Error("Adapter request failed"));
    renderPosts();
    // The query client retries once, so the error state takes >1s to surface.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Error loading posts")).toBeTruthy();
    expect(screen.getByText("Adapter request failed")).toBeTruthy();
  });

  it("shows a message when there are no posts", async () => {
    mockedFetchPosts.mockResolvedValue({
      data: [],
      meta: { pagination: { page: 1, pageSize: 5, pageCount: 0, total: 0 } },
    });
    renderPosts();
    await waitFor(() => expect(screen.getByText("No posts found.")).toBeTruthy());
  });
});
