import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ChannelEmbed } from "~/content/ChannelEmbed";
import { queryClient } from "~/data/query-client";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";

const { thumbnailMock } = vi.hoisted(() => ({
  thumbnailMock: vi.fn<(url: string) => Promise<string | null>>(),
}));

vi.mock("~/content/video-thumbnail", () => ({ videoThumbnail: thumbnailMock }));

const fetchMock = stubAdapterFetch();

const channel = {
  id: 549881,
  type: "Channel",
  slug: "philemon",
  title: "Philemon",
  owner: { id: 72639, type: "User", name: "Tom 🖇️", slug: "tom" },
};

const audioItem = {
  id: 18470442,
  type: "Attachment",
  base_type: "Block",
  title: "alan-watts-just-trust-the-universe.mp3",
  attachment: {
    filename: "285e74b50c0607f2f211627ef0f7d22f.mp3",
    content_type: "audio/mpeg",
    file_size: 102484564,
    file_extension: "mp3",
    url: "https://attachments.are.na/18470442/285e74b50c0607f2f211627ef0f7d22f.mp3",
  },
};

const videoItem = {
  id: 18470414,
  type: "Attachment",
  base_type: "Block",
  title: "jung-at-bollingen.mp4",
  attachment: {
    filename: "a7e22f45ab4e7a240c73b570ff53b3fa.mp4",
    content_type: "video/mp4",
    file_size: 82333882,
    file_extension: "mp4",
    url: "https://attachments.are.na/18470414/a7e22f45ab4e7a240c73b570ff53b3fa.mp4",
  },
};

const imageItem = {
  id: 26610738,
  type: "Image",
  base_type: "Block",
  title: "Cat butt",
  image: {
    medium: {
      src: "https://images.are.na/cat-medium.jpg",
      src_2x: "https://images.are.na/cat-2x.jpg",
    },
  },
};

const textItem = {
  id: 50614273,
  type: "Text",
  base_type: "Block",
  title: null,
  content: { markdown: "Hello world", html: "<p>Hello world</p>", plain: "Hello world" },
};

const stubChannel = (items: unknown[]) =>
  fetchMock.mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(jsonResponse(String(input).includes("/contents") ? { data: items } : channel)),
  );

const renderStrip = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <ChannelEmbed slug="philemon" title="Philemon" />
    </QueryClientProvider>
  ));

beforeEach(() => {
  queryClient.clear();
  fetchMock.mockReset();
  thumbnailMock.mockReset();
  thumbnailMock.mockResolvedValue(null);
});

describe("ChannelEmbed", { timeout: 30_000 }, () => {
  it("plays an audio attachment instead of showing its filename", async () => {
    stubChannel([audioItem]);
    renderStrip();

    await waitFor(() => expect(document.querySelector("audio")).toBeTruthy());
    const player = document.querySelector("audio") as HTMLAudioElement;
    expect(player.getAttribute("src")).toBe(
      "https://attachments.are.na/18470442/285e74b50c0607f2f211627ef0f7d22f.mp3",
    );
    expect(player.hasAttribute("controls")).toBe(true);
    expect(screen.getByText("alan-watts-just-trust-the-universe.mp3")).toBeTruthy();
  });

  it("loads a video attachment on click rather than up front", async () => {
    stubChannel([videoItem]);
    renderStrip();

    const trigger = await screen.findByRole("button", { name: /play jung-at-bollingen\.mp4/i });
    expect(document.querySelector("video")).toBeNull();

    await userEvent.click(trigger);

    await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
    expect(document.querySelector("video")?.getAttribute("src")).toBe(
      "https://attachments.are.na/18470414/a7e22f45ab4e7a240c73b570ff53b3fa.mp4",
    );
    expect(document.querySelector("video")?.hasAttribute("controls")).toBe(true);
  });

  it("still shows a cover image for an item that has one", async () => {
    stubChannel([imageItem]);
    renderStrip();

    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe(
        "https://images.are.na/cat-medium.jpg",
      ),
    );
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("still falls back to a title card for an item with nothing to play", async () => {
    stubChannel([textItem]);
    renderStrip();

    await waitFor(() => expect(screen.getByText("Hello world")).toBeTruthy());
    expect(document.querySelector("audio")).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });
});
