import "@testing-library/jest-dom";
import { cleanup } from "@solidjs/testing-library";
import { afterEach, vi } from "vitest";

// solid-motionone ships a .jsx entry that node cannot load; the components
// barrel imports it via Arena, so stub it for tests that pull the barrel in.
vi.mock("solid-motionone", () => ({
  Motion: (props: { children?: unknown }) => props.children,
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Global cleanup after each test
afterEach(() => {
  cleanup();
});
