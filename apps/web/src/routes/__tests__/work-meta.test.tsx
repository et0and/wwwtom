import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { createRouter, memoryHistory } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { HttpError } from "@tom/types/errors";
import WorkPage from "~/routes/work/[slug]";

vi.mock("~/server/adapter", () => ({
  fetchWorkBySlug: vi.fn(),
}));

import { fetchWorkBySlug } from "~/server/adapter";

const mockedFetchWorkBySlug = fetchWorkBySlug as Mock;

const workData = {
  id: "work-1",
  title: "An idea for a performance",
  summary: "A tool for generating performance ideas.",
  slug: "an-idea-for-a-performance",
  meta: { description: "A meta description" },
  html: "<p>A tool for generating performance ideas.</p>",
  arenaBlocks: [],
};

const TestRouter = createRouter({
  history: memoryHistory("/work/an-idea-for-a-performance"),
  routes: [{ path: "/work/:slug", component: WorkPage }],
});

const renderWorkPage = () => {
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
  mockedFetchWorkBySlug.mockReset();
});

describe("work page meta tags", () => {
  it("renders title, description and og/twitter meta into the document head", async () => {
    mockedFetchWorkBySlug.mockResolvedValue(workData);
    renderWorkPage();
    await waitFor(() => expect(screen.getByText("An idea for a performance")).toBeTruthy());

    expect(document.head.querySelector("title")?.textContent).toBe(
      "An idea for a performance | Tom Hackshaw",
    );
    expect(headMeta('meta[name="description"]')).toBe("A tool for generating performance ideas.");
    expect(headMeta('meta[property="og:title"]')).toBe("An idea for a performance | Tom Hackshaw");
    expect(headMeta('meta[property="og:description"]')).toBe(
      "A tool for generating performance ideas.",
    );
    expect(headMeta('meta[name="twitter:title"]')).toBe("An idea for a performance | Tom Hackshaw");
    expect(headMeta('meta[name="twitter:card"]')).toBe("summary_large_image");
  });

  it("points og:image and twitter:image at the public adapter proxy, absolute", async () => {
    mockedFetchWorkBySlug.mockResolvedValue(workData);
    renderWorkPage();
    await waitFor(() => expect(screen.getByText("An idea for a performance")).toBeTruthy());

    const imageUrl =
      "https://adapter.tom.so/og?title=An%20idea%20for%20a%20performance" +
      "&summary=A%20tool%20for%20generating%20performance%20ideas.";

    expect(headMeta('meta[property="og:image"]')).toBe(imageUrl);
    expect(headMeta('meta[name="twitter:image"]')).toBe(imageUrl);
  });

  it("shows a spinner — not Not found — while the work is loading", async () => {
    mockedFetchWorkBySlug.mockReturnValue(new Promise(() => {}));
    renderWorkPage();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.queryByText("Not found")).toBeNull();
  });

  it("shows Not found once a missing slug settles to null", async () => {
    mockedFetchWorkBySlug.mockResolvedValue(null);
    renderWorkPage();
    await waitFor(() => expect(screen.getByText("Not found")).toBeTruthy());
    expect(screen.getByText('The work "an-idea-for-a-performance" does not exist.')).toBeTruthy();
    expect(document.head.querySelector("title")?.textContent).toBe("Not found | Tom Hackshaw");
  });

  it("shows an error banner — not Not found — on a server error", async () => {
    mockedFetchWorkBySlug.mockRejectedValue(
      new HttpError({ message: "Adapter request failed", status: 500 }),
    );
    renderWorkPage();
    await waitFor(() => expect(screen.getByText("Error loading work")).toBeTruthy());
    expect(screen.queryByText("Not found")).toBeNull();
    expect(document.head.querySelector("title")?.textContent).toBe("Error | Tom Hackshaw");
  });
});
