import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { Schema } from "effect";
import { ArenaContentBlockSchema } from "@tom/schemas/arena-content";
import { queryClient } from "~/libs/query-client";
import { ContentBlocks } from "~/components/ContentBlocks";

vi.mock("~/server/adapter", () => ({
  fetchChannel: vi.fn(),
  fetchChannelContents: vi.fn(),
}));

import { fetchChannel, fetchChannelContents } from "~/server/adapter";

const mockedFetchChannel = fetchChannel as Mock;
const mockedFetchChannelContents = fetchChannelContents as Mock;

const decodeBlock = Schema.decodeUnknownSync(ArenaContentBlockSchema);

beforeEach(() => {
  queryClient.clear();
  mockedFetchChannel.mockReset();
  mockedFetchChannelContents.mockReset();
});

describe("ContentBlocks", () => {
  it("renders a text block as rich HTML", async () => {
    const blocks = [
      decodeBlock({
        id: 1,
        type: "Text",
        content: {
          markdown: "Hello there",
          html: "<p>Hello there</p>",
          plain: "Hello there",
        },
      }),
    ];

    render(() => <ContentBlocks blocks={blocks} />);

    expect(await screen.findByText("Hello there")).toBeTruthy();
  });

  it("renders an image block with its alt text", () => {
    const blocks = [
      decodeBlock({
        id: 2,
        type: "Image",
        image: {
          src: "https://images.are.na/original.jpg",
          alt_text: "A picture",
          medium: {
            src: "https://images.are.na/medium.jpg",
            src_2x: "https://images.are.na/medium@2x.jpg",
          },
        },
      }),
    ];

    render(() => <ContentBlocks blocks={blocks} />);

    const image = screen.getByAltText("A picture") as HTMLImageElement;
    expect(image.src).toBe("https://images.are.na/medium.jpg");
    expect(image.getAttribute("srcset")).toBe(
      "https://images.are.na/medium.jpg 1x, https://images.are.na/medium@2x.jpg 2x",
    );
  });

  it("renders a link block pointing at its source", () => {
    const blocks = [
      decodeBlock({
        id: 3,
        type: "Link",
        title: "A link",
        source: { url: "https://example.com/article", title: "Article" },
      }),
    ];

    render(() => <ContentBlocks blocks={blocks} />);

    const link = screen.getByRole("link", { name: "A link" }) as HTMLAnchorElement;
    expect(link.href).toBe("https://example.com/article");
  });

  it("renders a connected channel as an are.na channel embed", async () => {
    mockedFetchChannel.mockResolvedValue({
      id: 7001,
      type: "Channel",
      slug: "poetics-of-space-gvdouhcpye0",
      title: "Poetics of Space",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      state: "available",
      visibility: "closed",
      owner: {
        id: 1,
        type: "User",
        name: "Tom Hackshaw",
        slug: "tom-hackshaw",
        avatar: null,
        initials: "TH",
      },
      counts: { blocks: 3, channels: 0, contents: 3, collaborators: 0 },
      _links: {},
    });
    mockedFetchChannelContents.mockResolvedValue({
      data: [
        {
          id: 9001,
          type: "Image",
          base_type: "Block",
          title: "A nested image",
          image: {
            alt_text: "A nested image",
            medium: {
              src: "https://images.are.na/nested.jpg",
              src_2x: "https://images.are.na/nested@2x.jpg",
            },
          },
        },
      ],
      meta: {
        current_page: 1,
        per_page: 12,
        total_pages: 1,
        total_count: 1,
        has_more_pages: false,
      },
    });
    const blocks = [
      decodeBlock({
        id: 5,
        type: "Channel",
        slug: "poetics-of-space-gvdouhcpye0",
        title: "Poetics of Space",
      }),
    ];

    render(() => (
      <QueryClientProvider client={queryClient}>
        <ContentBlocks blocks={blocks} />
      </QueryClientProvider>
    ));

    expect(await screen.findByText("Poetics of Space")).toBeTruthy();
    expect(await screen.findByText("by Tom Hackshaw")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Poetics of Space" }).getAttribute("href")).toBe(
        "https://are.na/tom-hackshaw/poetics-of-space-gvdouhcpye0",
      ),
    );
    expect(mockedFetchChannel).toHaveBeenCalledWith("poetics-of-space-gvdouhcpye0");
    expect(mockedFetchChannelContents).toHaveBeenCalledWith("poetics-of-space-gvdouhcpye0", 12);
    expect(await screen.findByAltText("A nested image")).toBeTruthy();
  });

  it("loads a video attachment only after a click", async () => {
    const blocks = [
      decodeBlock({
        id: 7,
        type: "Attachment",
        title: "jung-at-bollingen.mp4",
        attachment: {
          url: "https://attachments.are.na/jung-at-bollingen.mp4",
          filename: "jung-at-bollingen.mp4",
          content_type: "video/mp4",
        },
      }),
    ];

    const { container } = render(() => <ContentBlocks blocks={blocks} />);

    expect(container.querySelector("video")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Play jung-at-bollingen.mp4" }));

    await waitFor(() => expect(container.querySelector("video")).toBeTruthy());
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("https://attachments.are.na/jung-at-bollingen.mp4");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  const pdfBlocks = [
    decodeBlock({
      id: 6,
      type: "Attachment",
      title: "reading-machines.pdf",
      attachment: {
        url: "https://attachments.are.na/reading-machines.pdf",
        filename: "reading-machines.pdf",
        content_type: "application/pdf",
      },
      image: {
        src: "https://d2w9rnfcy7mm78.cloudfront.net/original.png",
        medium: {
          src: "https://images.are.na/cover.png",
          src_2x: "https://images.are.na/cover@2x.png",
        },
      },
    }),
  ];

  it("opens a pdf attachment in a dialog, with its are.na cover", async () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({ matches: true }) as MediaQueryList) as typeof window.matchMedia;

    try {
      render(() => <ContentBlocks blocks={pdfBlocks} />);

      const cover = screen.getByAltText("reading-machines.pdf") as HTMLImageElement;
      expect(cover.src).toBe("https://images.are.na/cover.png");

      fireEvent.click(screen.getByRole("link", { name: /reading-machines\.pdf/ }));

      await waitFor(() => expect(screen.getByTitle("reading-machines.pdf")).toBeTruthy());
      const viewer = screen.getByTitle("reading-machines.pdf");
      expect(viewer.getAttribute("src")).toBe("https://attachments.are.na/reading-machines.pdf");
      expect(viewer.getAttribute("type")).toBe("application/pdf");

      const download = screen.getByRole("link", {
        name: "Open in a new tab",
      }) as HTMLAnchorElement;
      expect(download.href).toBe("https://attachments.are.na/reading-machines.pdf");
    } finally {
      window.matchMedia = original;
    }
  });

  it("sends a pdf attachment to the native viewer on phone widths", () => {
    render(() => <ContentBlocks blocks={pdfBlocks} />);

    const link = screen.getByRole("link", { name: /reading-machines\.pdf/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://attachments.are.na/reading-machines.pdf");
    expect(link.target).toBe("_blank");

    fireEvent.click(link);

    expect(screen.queryByTitle("reading-machines.pdf")).toBeNull();
  });

  it("renders nothing for a block that is still processing", () => {
    const blocks = [decodeBlock({ id: 4, type: "PendingBlock" })];

    const { container } = render(() => <ContentBlocks blocks={blocks} />);

    expect(container.querySelector("img, a, p")).toBeNull();
  });
});
