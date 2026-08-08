import { vi } from "vitest";

// @cf-wasm/photon only loads inside the Cloudflare Workers runtime; the
// adapter's image integration imports it at module scope, so provide a stub.
vi.mock("@cf-wasm/photon", () => ({
  PhotonImage: class PhotonImage {},
  resize: vi.fn(),
  SamplingFilter: { Nearest: 0, Triangle: 1, CatmullRom: 2, Gaussian: 3, Lanczos3: 4 },
}));
