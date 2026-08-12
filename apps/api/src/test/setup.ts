import { vi } from "vitest";

// workers-og only loads inside the Cloudflare Workers runtime; the API's og
// service imports it at module scope, so provide a stub.
vi.mock("workers-og", () => ({
  ImageResponse: class ImageResponse extends Response {
    constructor(body: BodyInit, init?: ResponseInit) {
      super(body, init);
    }
  },
}));

// @tom/ui ships Solid JSX source; the og service only reads the template map,
// so provide a stub instead of pulling the Solid toolchain into node tests.
vi.mock("@tom/ui/OgImage", () => ({
  OgTemplates: {},
}));
