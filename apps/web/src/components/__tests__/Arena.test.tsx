import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ArenaCarousel } from "~/components/Arena";
import { queryClient } from "~/libs/query-client";

vi.mock("~/server/adapter", () => ({
  fetchChannelContents: vi.fn(),
}));

import { fetchChannelContents } from "~/server/adapter";

const mockedFetchChannelContents = fetchChannelContents as Mock;

const pdfAttachment = {
  id: 18470324,
  type: "Attachment",
  base_type: "Block",
  title: "taoism-and-jung-synchronicity-and-the-self.pdf",
  attachment: {
    filename: "990bb9f5efd08e9035d743d0a9781ba9.pdf",
    content_type: "application/pdf",
    file_size: 590334,
    file_extension: "pdf",
    url: "https://attachments.are.na/18470324/990bb9f5efd08e9035d743d0a9781ba9.pdf",
  },
  image: {
    medium: {
      src: "https://images.are.na/pdf-thumb.png",
      src_2x: "https://images.are.na/pdf-thumb-2x.png",
    },
  },
};

const epubAttachment = {
  id: 2,
  type: "Attachment",
  base_type: "Block",
  title: "memories-dreams-reflections.epub",
  attachment: {
    filename: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5.epub",
    content_type: "application/epub+zip",
    file_size: 1024 * 1024 * 2,
    file_extension: "epub",
    url: "https://attachments.are.na/2/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5.epub",
  },
};

const audioAttachment = {
  id: 3,
  type: "Attachment",
  base_type: "Block",
  title: "alan-watts-just-trust-the-universe.mp3",
  attachment: {
    filename: "285e74b50c0607f2f211627ef0f7d22f.mp3",
    content_type: "audio/mpeg",
    file_size: 2048,
    file_extension: "mp3",
    url: "https://attachments.are.na/3/285e74b50c0607f2f211627ef0f7d22f.mp3",
  },
};

const videoEmbed = {
  id: 7196988,
  type: "Embed",
  base_type: "Block",
  title: "Dr. Chris Milton: Figure and Ground",
  embed: {
    html: '<iframe src="https://www.youtube.com/embed/dCUVdh8MJe8" width="640" height="360"></iframe>',
    width: 640,
    height: 360,
    source_url: "https://www.youtube.com/watch?v=dCUVdh8MJe8",
  },
  image: {
    medium: {
      src: "https://i.ytimg.com/vi/dCUVdh8MJe8/hqdefault.jpg",
      src_2x: "https://i.ytimg.com/vi/dCUVdh8MJe8/hqdefault-2x.jpg",
    },
  },
};

const imageBlock = {
  id: 6932930,
  type: "Image",
  base_type: "Block",
  title: "The Psychology of CG Jung",
  image: {
    medium: {
      src: "https://images.are.na/image-medium.jpg",
      src_2x: "https://images.are.na/image-medium-2x.jpg",
    },
  },
};

const renderCarousel = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <ArenaCarousel slug="philemon" title="Philemon" />
    </QueryClientProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  mockedFetchChannelContents.mockReset();
});

describe("ArenaCarousel", () => {
  it("renders a readable name and thumbnail for PDF attachments instead of the hashed filename", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [pdfAttachment] });
    renderCarousel();

    await waitFor(() =>
      expect(screen.getByText("taoism-and-jung-synchronicity-and-the-self.pdf")).toBeTruthy(),
    );
    expect(screen.queryByText("990bb9f5efd08e9035d743d0a9781ba9.pdf")).toBeNull();
    expect(screen.getByAltText("taoism-and-jung-synchronicity-and-the-self.pdf")).toHaveAttribute(
      "src",
      "https://images.are.na/pdf-thumb.png",
    );
    expect(
      screen.getByRole("link", { name: /taoism-and-jung-synchronicity-and-the-self\.pdf/ }),
    ).toHaveAttribute(
      "href",
      "https://attachments.are.na/18470324/990bb9f5efd08e9035d743d0a9781ba9.pdf",
    );
  });

  it("falls back to a readable name link for attachments without a cover image", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [epubAttachment] });
    renderCarousel();

    await waitFor(() => expect(screen.getByText("memories-dreams-reflections.epub")).toBeTruthy());
    expect(screen.queryByText("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5.epub")).toBeNull();
    const link = screen.getByRole("link", { name: /memories-dreams-reflections\.epub/ });
    expect(link).toHaveAttribute("href", expect.stringContaining(".epub"));
  });

  it("renders audio attachments as an audio player", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [audioAttachment] });
    renderCarousel();

    await waitFor(() => expect(document.querySelector("audio")).toBeTruthy());
    expect(document.querySelector("audio")).toHaveAttribute(
      "src",
      "https://attachments.are.na/3/285e74b50c0607f2f211627ef0f7d22f.mp3",
    );
  });

  it("shows a play poster for video embeds and loads the iframe on click", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [videoEmbed] });
    renderCarousel();

    const playButton = await screen.findByRole("button", { name: /play dr\. chris milton/i });
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByAltText("Dr. Chris Milton: Figure and Ground")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dCUVdh8MJe8/hqdefault.jpg",
    );

    fireEvent.click(playButton);

    await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /play dr\. chris milton/i })).toBeNull();
  });

  it("renders the embed iframe directly when the embed has no thumbnail image", async () => {
    const embedWithoutImage = {
      ...videoEmbed,
      image: undefined,
    };
    mockedFetchChannelContents.mockResolvedValue({ data: [embedWithoutImage] });
    renderCarousel();

    await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /play dr\. chris milton/i })).toBeNull();
  });

  it("does not open a lightbox when an image block is clicked", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [imageBlock] });
    renderCarousel();

    const image = await screen.findByAltText("The Psychology of CG Jung");
    fireEvent.click(image);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".fixed.inset-0")).toBeNull();
  });

  it("links to the are.na source channel", async () => {
    mockedFetchChannelContents.mockResolvedValue({ data: [pdfAttachment] });
    renderCarousel();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Philemon" })).toHaveAttribute(
        "href",
        "https://are.na/tom/philemon",
      ),
    );
  });
});
