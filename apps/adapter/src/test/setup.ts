import { vi } from "vitest";

// @cf-wasm/photon only loads inside the Cloudflare Workers runtime, so the
// adapter's image integration imports it at module scope. The stub keeps the
// crop/resize contract and returns a solid red 240x135 frame, which lets the
// RGB565 encoder be asserted end to end.
vi.mock("@cf-wasm/photon", () => {
  const framePixels = 240 * 135;
  const rgba = Uint8Array.from({ length: framePixels * 4 }, (_, index) =>
    index % 4 === 0 || index % 4 === 3 ? 255 : 0,
  );
  class PhotonImage {
    static new_from_byteslice(): PhotonImage {
      return new PhotonImage();
    }
    get_width(): number {
      return 240;
    }
    get_height(): number {
      return 135;
    }
    get_raw_pixels(): Uint8Array {
      return rgba;
    }
    free(): void {}
  }
  return {
    PhotonImage,
    crop: (image: PhotonImage) => image,
    resize: (image: PhotonImage) => image,
    SamplingFilter: { Nearest: 0, Triangle: 1, CatmullRom: 2, Gaussian: 3, Lanczos3: 4 },
  };
});
