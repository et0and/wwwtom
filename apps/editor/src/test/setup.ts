import "@testing-library/jest-dom";
import { cleanup } from "@solidjs/testing-library";
import { afterEach } from "vitest";

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

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: class {
    constructor(callback: ResizeObserverCallback) {
      void callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
});

afterEach(() => {
  cleanup();
});
