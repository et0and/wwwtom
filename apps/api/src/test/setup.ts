import { vi } from "vitest";

// Takumi renders through a native binding locally; stub the render call so
// route tests stay hermetic. fromHtml stays real (pure string parsing).
vi.mock("takumi-js", () => ({
  render: () => Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
}));

// @tom/ui/OgImage is plain template-string functions (no Solid runtime), so
// the real module loads here and getTemplate identity assertions stay
// meaningful. fromHtml stays real (pure string parsing).
