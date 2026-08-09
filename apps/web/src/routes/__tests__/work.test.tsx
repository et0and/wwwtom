import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { Router, Route } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { MetaProvider } from "@solidjs/meta";
import { queryClient } from "~/libs/query-client";
import WorkHome from "~/routes/work/index";

vi.mock("~/server/adapter", () => ({
  fetchWorks: vi.fn(),
}));

import { fetchWorks } from "~/server/adapter";

const mockedFetchWorks = fetchWorks as Mock;

const worksPayload = [
  {
    id: "1",
    title: "An idea for a performance",
    summary: "A tool for generating performance ideas.",
    slug: "an-idea-for-a-performance",
  },
  {
    id: "2",
    title: "Hyperjam",
    summary: "A Merveilles online game festival.",
    slug: "hyperjam",
  },
];

const renderWorkHome = () =>
  render(() => (
    <MetaProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Route path="/" component={WorkHome} />
        </Router>
      </QueryClientProvider>
    </MetaProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  mockedFetchWorks.mockReset();
});

describe("work page", () => {
  it("renders works fetched through the server function", async () => {
    mockedFetchWorks.mockResolvedValue(worksPayload);
    renderWorkHome();
    await waitFor(() => expect(screen.getByText("An idea for a performance")).toBeTruthy());
    expect(screen.getByText("Hyperjam")).toBeTruthy();
    expect(screen.getByText("A tool for generating performance ideas.")).toBeTruthy();
    expect(mockedFetchWorks).toHaveBeenCalledTimes(1);
  });

  it("shows the error banner when the server function fails", async () => {
    mockedFetchWorks.mockRejectedValue(new Error("Adapter request failed"));
    renderWorkHome();
    // The query client retries once, so the error state takes >1s to surface.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByText("Error loading works")).toBeTruthy();
    expect(screen.getByText("Adapter request failed")).toBeTruthy();
  });
});
