import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../lib/query-client";
import { App } from "../App";

// The App shell owns live-network useQuery calls through these fetchers;
// stub them so the shell tests never touch the network and each test owns
// a cleared cache (see beforeEach).
vi.mock("../lib/posts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/posts")>();
  return {
    ...original,
    fetchPosts: vi.fn(async () => ({
      docs: [],
      totalDocs: 0,
      limit: 10,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })),
    fetchCategories: vi.fn(async () => []),
    fetchAbout: vi.fn(async () => {
      throw new Error("fetchAbout is stubbed in App shell tests");
    }),
    fetchPost: vi.fn(async () => {
      throw new Error("fetchPost is stubbed in App shell tests");
    }),
  };
});

describe("Sophie App", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    window.history.replaceState(null, "", "/");
  });

  it("wraps in-app navigation in a view transition", async () => {
    const viewTransition: ViewTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      types: new Set<string>(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    };
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return viewTransition;
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    const { findByRole } = render(() => <App />);
    fireEvent.click(await findByRole("link", { name: "About" }));

    expect(startViewTransition).toHaveBeenCalledTimes(1);
  });

  it("shows the Sophie wordmark on the index with an About link only", async () => {
    const { findAllByRole, findByRole } = render(() => <App />);
    expect(await findByRole("link", { name: "Sophie" })).toBeInTheDocument();
    expect(await findByRole("link", { name: "About" })).toBeInTheDocument();
    expect((await findAllByRole("link")).map((link) => link.textContent)).toEqual([
      "Sophie",
      "About",
    ]);
  });

  it("never names a last name and pins the footer", async () => {
    const { findByText } = render(() => <App />);
    expect(await findByText("All rights reserved")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Tremaine");
    expect(document.body.innerHTML).not.toContain("tremaine");
  });
});
