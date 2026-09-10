import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createRouter, memoryHistory } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { queryClient } from "~/libs/query-client";
import PostsHome from "~/routes/posts/index";

vi.mock("~/server/adapter", () => ({
  POSTS_PAGE_SIZE: 5,
  fetchPosts: vi.fn(),
}));

import { fetchPosts } from "~/server/adapter";

// The fixtures are intentionally minimal; the server function's CMS list
// shape is not what this UI test cares about.
const mockedFetchPosts = fetchPosts as Mock;

const postsData = {
  docs: [
    {
      id: "post-1",
      title: "A pattern language",
      summary: "On imagining a monorepo as a shared house",
      slug: "a-pattern-language",
      publishedAt: "2026-06-30T00:00:00.000Z",
      meta: { description: "A meta description" },
    },
    {
      id: "post-2",
      title: "On git notes",
      summary: "Using a niche git feature",
      slug: "on-git-notes",
      publishedAt: "2026-05-28T00:00:00.000Z",
      meta: { description: "Another description" },
    },
  ],
  totalDocs: 2,
  limit: 5,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

const TestRouter = createRouter({
  history: memoryHistory("/"),
  routes: [{ path: "/", component: PostsHome }],
});

const renderPosts = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <TestRouter />
    </QueryClientProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  mockedFetchPosts.mockReset();
});

describe("posts page", () => {
  it("renders posts fetched through the server function", async () => {
    mockedFetchPosts.mockResolvedValue(postsData);
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
      docs: [],
      totalDocs: 0,
      limit: 5,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    renderPosts();
    await waitFor(() => expect(screen.getByText("No posts found.")).toBeTruthy());
  });

  it("swaps to page 2 on client navigation", async () => {
    // Placeholder data wedged this flow (the new page never replaced the
    // old one), so pin the swap: click Next, page 2 renders, page 1 clears.
    const oldest = {
      id: "post-9",
      title: "Oldest post",
      summary: "The oldest",
      slug: "oldest-post",
      publishedAt: "2020-01-01T00:00:00.000Z",
      meta: { description: "Old" },
    };
    mockedFetchPosts.mockImplementation((page: number) =>
      Promise.resolve(
        page === 2
          ? { ...postsData, docs: [oldest], page: 2, totalPages: 2 }
          : { ...postsData, totalPages: 2 },
      ),
    );
    const NavRouter = createRouter({
      history: memoryHistory("/posts"),
      routes: [{ path: "/posts", component: PostsHome }],
    });
    render(() => (
      <QueryClientProvider client={queryClient}>
        <NavRouter />
      </QueryClientProvider>
    ));
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());
    fireEvent.click(screen.getByRole("link", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Oldest post")).toBeTruthy());
    expect(screen.queryByText("A pattern language")).toBeNull();
    expect(mockedFetchPosts).toHaveBeenCalledWith(2, 5);
  }, 10000);
});
