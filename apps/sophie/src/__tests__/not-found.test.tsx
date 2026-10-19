import { render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

// The shell's own fetchers are stubbed so routing an unknown path never
// touches the network; this test is about the response status, not the data.
vi.mock("../posts/posts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../posts/posts")>();
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
    fetchAbout: vi.fn(async () => null),
    fetchPost: vi.fn(async () => null),
  };
});

/**
 * `httpStatus` from @solidjs/web is a no-op outside a server request, so the
 * status contract is asserted by spying on it: the 404 route must ask for 404
 * on every unmatched path, or a scanner probing `/.env` reads the Missing
 * page as a 200 and believes it found something.
 */
const statusSpy = vi.hoisted(() => vi.fn());

vi.mock("@solidjs/web", async (importOriginal) => {
  const original = await importOriginal<typeof import("@solidjs/web")>();
  return { ...original, httpStatus: statusSpy };
});

describe("Sophie unknown paths", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("answers an unmatched path with 404, not 200", async () => {
    window.history.replaceState(null, "", "/.env");
    render(() => <App />);

    expect(await screen.findByText("No page lives here.")).toBeTruthy();
    expect(statusSpy).toHaveBeenCalledWith(404);
  });
});
