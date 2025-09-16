import "@testing-library/jest-dom";
import { cleanup } from "@solidjs/testing-library";

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
