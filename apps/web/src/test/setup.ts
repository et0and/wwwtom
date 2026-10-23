import "@testing-library/jest-dom";
import { cleanup } from "@solidjs/testing-library";
import { afterEach } from "vitest";

// jsdom has no layout, so scrollTo and matchMedia need shims.
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

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
