import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { createRouter, memoryHistory } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { queryClient } from "~/libs/query-client";
import WorkHome from "~/routes/work/index";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";

const fetchMock = stubAdapterFetch();

const worksData = {
  docs: [
    {
      id: 1,
      title: "An idea for a performance",
      summary: "A tool for generating performance ideas.",
      slug: "an-idea-for-a-performance",
    },
    {
      id: 2,
      title: "Hyperjam",
      summary: "A Merveilles online game festival.",
      slug: "hyperjam",
    },
  ],
  totalDocs: 2,
  limit: 10,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

const TestRouter = createRouter({
  history: memoryHistory("/"),
  routes: [{ path: "/", component: WorkHome }],
});

const renderWorkHome = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <TestRouter />
    </QueryClientProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockReset();
});

describe("work page", () => {
  it("renders works fetched through the adapter", async () => {
    fetchMock.mockResolvedValue(jsonResponse(worksData));
    renderWorkHome();
    await waitFor(() => expect(screen.getByText("An idea for a performance")).toBeTruthy());
    expect(screen.getByText("Hyperjam")).toBeTruthy();
    expect(screen.getByText("A tool for generating performance ideas.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8788/content/arena/works",
      expect.anything(),
    );
  });

  it("shows the error banner when the adapter request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderWorkHome();
    // The query client retries once, so the error state takes >1s to surface.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Error loading works")).toBeTruthy();
    expect(screen.getByText("Adapter request failed")).toBeTruthy();
  });
});
