import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { MetaProvider } from "@solidjs/meta";
import { queryClient } from "~/libs/query-client";
import WorkPage from "~/routes/work/[slug]";

vi.mock("~/server/adapter", () => ({
  fetchWorkBySlug: vi.fn(),
}));

import { fetchWorkBySlug } from "~/server/adapter";

const mockedFetchWorkBySlug = fetchWorkBySlug as Mock;

const workPayload = {
  id: "1",
  title: "An idea for a performance",
  summary: "A tool for generating performance ideas.",
  slug: "an-idea-for-a-performance",
  meta: { description: "A meta description" },
  content: "<p>A tool for generating performance ideas.</p>",
  arenaBlocks: [],
};

const renderWorkPage = () => {
  const history = createMemoryHistory();
  history.set({ value: "/work/an-idea-for-a-performance" });
  return render(() => (
    <MetaProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter history={history}>
          <Route path="/work/:slug" component={WorkPage} />
        </MemoryRouter>
      </QueryClientProvider>
    </MetaProvider>
  ));
};

const headMeta = (selector: string): string | null | undefined =>
  document.head.querySelector(selector)?.getAttribute("content");

beforeEach(() => {
  queryClient.clear();
  mockedFetchWorkBySlug.mockReset();
});

describe("work page meta tags", () => {
  it("renders title, description and og/twitter meta into the document head", async () => {
    mockedFetchWorkBySlug.mockResolvedValue(workPayload);
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
    mockedFetchWorkBySlug.mockResolvedValue(workPayload);
    renderWorkPage();
    await waitFor(() => expect(screen.getByText("An idea for a performance")).toBeTruthy());

    const imageUrl =
      "https://adapter.tom.so/og?title=An%20idea%20for%20a%20performance" +
      "&summary=A%20tool%20for%20generating%20performance%20ideas.";

    expect(headMeta('meta[property="og:image"]')).toBe(imageUrl);
    expect(headMeta('meta[name="twitter:image"]')).toBe(imageUrl);
  });
});
