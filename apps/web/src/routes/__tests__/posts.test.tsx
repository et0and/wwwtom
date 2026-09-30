import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createRouter, memoryHistory } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { queryClient } from "~/libs/query-client";
import PostsHome from "~/routes/posts/index";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";

const fetchMock = stubAdapterFetch();

// The fixtures are intentionally minimal; the adapter's CMS list shape is
// not what this UI test cares about.
const postsData = {
  docs: [
    {
      id: 1,
      title: "A pattern language",
      summary: "On imagining a monorepo as a shared house",
      slug: "a-pattern-language",
      publishedAt: "2026-06-30T00:00:00.000Z",
    },
    {
      id: 2,
      title: "On git notes",
      summary: "Using a niche git feature",
      slug: "on-git-notes",
      publishedAt: "2026-05-28T00:00:00.000Z",
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
  fetchMock.mockReset();
});

describe("posts page", () => {
  it("renders posts fetched through the adapter", async () => {
    fetchMock.mockResolvedValue(jsonResponse(postsData));
    renderPosts();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());
    expect(screen.getByText("On git notes")).toBeTruthy();
    expect(screen.getByText("On imagining a monorepo as a shared house")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8788/content/arena/posts?page=1&pageSize=5",
      expect.anything(),
    );
  });

  it("shows the error banner when the adapter request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderPosts();
    // The query client retries once, so the error state takes >1s to surface.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Error loading posts")).toBeTruthy();
    expect(screen.getByText("Adapter request failed")).toBeTruthy();
  });

  it("shows a message when there are no posts", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        docs: [],
        totalDocs: 0,
        limit: 5,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      }),
    );
    renderPosts();
    await waitFor(() => expect(screen.getByText("No posts found.")).toBeTruthy());
  });

  it("re-renders the list when cached data is replaced", async () => {
    // A preloaded page arrives as a new data object under a new key. The
    // list must follow the identity change, not just the truthiness toggle.
    const oldest = {
      id: 9,
      title: "Oldest post",
      summary: "The oldest",
      slug: "oldest-post",
      publishedAt: "2020-01-01T00:00:00.000Z",
    };
    fetchMock.mockResolvedValue(jsonResponse({ ...postsData, totalPages: 2 }));
    renderPosts();
    await waitFor(() => expect(screen.getByText("A pattern language")).toBeTruthy());

    queryClient.setQueryData(["posts", 1], {
      ...postsData,
      docs: [oldest],
      totalPages: 2,
    });

    await waitFor(() => expect(screen.getByText("Oldest post")).toBeTruthy());
    expect(screen.queryByText("A pattern language")).toBeNull();
  });

  it("swaps to page 2 on client navigation", async () => {
    // Placeholder data wedged this flow (the new page never replaced the
    // old one), so pin the swap: click Next, page 2 renders, page 1 clears.
    const oldest = {
      id: 9,
      title: "Oldest post",
      summary: "The oldest",
      slug: "oldest-post",
      publishedAt: "2020-01-01T00:00:00.000Z",
    };
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.includes("page=2")
            ? { ...postsData, docs: [oldest], page: 2, totalPages: 2 }
            : { ...postsData, totalPages: 2 },
        ),
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
    await userEvent.click(screen.getByRole("link", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Oldest post")).toBeTruthy());
    expect(screen.queryByText("A pattern language")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8788/content/arena/posts?page=2&pageSize=5",
      expect.anything(),
    );
  }, 10000);
});
