import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { CanvasChannel } from "~/components/Canvas/CanvasChannel";
import { queryClient } from "~/libs/query-client";

vi.mock("~/server/adapter", () => ({
  fetchChannel: vi.fn(),
  fetchChannelContentsPage: vi.fn(),
}));

import { fetchChannel, fetchChannelContentsPage } from "~/server/adapter";

const mockedFetchChannel = fetchChannel as Mock;
const mockedFetchContentsPage = fetchChannelContentsPage as Mock;

const imageBlock = {
  id: 6932930,
  type: "Image",
  base_type: "Block",
  title: "The Psychology of CG Jung",
  image: {
    small: {
      src: "https://images.are.na/image-small.jpg",
      src_2x: "https://images.are.na/image-small-2x.jpg",
    },
    medium: {
      src: "https://images.are.na/image-medium.jpg",
      src_2x: "https://images.are.na/image-medium-2x.jpg",
    },
  },
};

const textBlock = {
  id: 3001,
  type: "Text",
  base_type: "Block",
  title: "A note",
  content: {
    markdown: "Hello from the canvas",
    html: "<p>Hello from the canvas</p>",
    plain: "Hello from the canvas",
  },
};

const pageFor = (data: ReadonlyArray<unknown>) => ({
  data,
  meta: {
    current_page: 1,
    next_page: null,
    per_page: 100,
    total_pages: 1,
    total_count: data.length,
    has_more_pages: false,
  },
});

const renderCanvas = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <div class="h-dvh">
        <CanvasChannel slug="philemon" />
      </div>
    </QueryClientProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  mockedFetchChannel.mockReset();
  mockedFetchContentsPage.mockReset();
  mockedFetchChannel.mockResolvedValue({ title: "Philemon", slug: "philemon" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CanvasChannel", () => {
  it("scatters every block of the channel on the canvas", async () => {
    mockedFetchContentsPage.mockResolvedValue(pageFor([imageBlock, textBlock]));
    renderCanvas();

    await waitFor(() => expect(screen.getByAltText("The Psychology of CG Jung")).toBeTruthy());
    expect(screen.getByText("A note")).toBeTruthy();
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("zooms with the wheel once tiles mount", async () => {
    mockedFetchContentsPage.mockResolvedValue(pageFor([imageBlock, textBlock]));
    renderCanvas();

    await waitFor(() => expect(screen.getByAltText("The Psychology of CG Jung")).toBeTruthy());
    const viewport = document.querySelector(".touch-none") as HTMLElement;
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -500, clientX: 100, clientY: 100, bubbles: true }),
    );

    await waitFor(() => {
      const inner = viewport.firstElementChild as HTMLElement;
      expect(inner.style.transform).toContain("scale(2.117");
    });
  });

  it("pinch zooms the canvas around the touch midpoint", async () => {
    mockedFetchContentsPage.mockResolvedValue(pageFor([imageBlock, textBlock]));
    renderCanvas();

    await waitFor(() => expect(screen.getByAltText("The Psychology of CG Jung")).toBeTruthy());
    const viewport = document.querySelector(".touch-none") as HTMLElement;
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 260, clientY: 100 });

    await waitFor(() => {
      const inner = viewport.firstElementChild as HTMLElement;
      expect(inner.style.transform).toContain("scale(1.6)");
    });
  });

  it("opens the block detail dialog on tile click", async () => {
    mockedFetchContentsPage.mockResolvedValue(pageFor([imageBlock, textBlock]));
    renderCanvas();

    const tile = await screen.findByRole("button", { name: "A note" });
    fireEvent.click(tile);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getAllByText("Hello from the canvas")).toHaveLength(2);
  });

  it("renders a title fallback when an image block carries no versions", async () => {
    mockedFetchContentsPage.mockResolvedValue(
      pageFor([{ ...imageBlock, image: undefined, title: "Versionless image" }]),
    );
    renderCanvas();

    await waitFor(() => expect(screen.getByText("Versionless image")).toBeTruthy());
    expect(screen.queryByRole("img", { name: "Versionless image" })).toBeNull();
  });

  it("shows an empty state when the channel holds no blocks", async () => {
    mockedFetchContentsPage.mockResolvedValue(pageFor([]));
    renderCanvas();

    await waitFor(() => expect(screen.getByText("This channel holds no blocks.")).toBeTruthy());
  });

  it("shows the error state only when no block loads", async () => {
    vi.useFakeTimers();
    try {
      mockedFetchContentsPage.mockRejectedValue(new Error("too many requests"));
      renderCanvas();

      await vi.advanceTimersByTimeAsync(40000);
      expect(screen.getByText("This channel cannot load.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
