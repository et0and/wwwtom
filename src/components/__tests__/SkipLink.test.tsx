import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { SkipLink } from "~/components/SkipLink";

describe("SkipLink", () => {
	it("renders skip link with correct text", () => {
		render(() => <SkipLink />);

		expect(
			screen.getByRole("link", { name: "Skip to main content" }),
		).toBeInTheDocument();
	});

	it("has correct href attribute", () => {
		render(() => <SkipLink />);
		const link = screen.getByRole("link", { name: "Skip to main content" });

		expect(link).toHaveAttribute("href", "#main");
	});

	it("has screen reader only classes by default", () => {
		render(() => <SkipLink />);
		const link = screen.getByRole("link", { name: "Skip to main content" });

		expect(link).toHaveClass("sr-only");
	});

	it("has focus visibility classes", () => {
		render(() => <SkipLink />);
		const link = screen.getByRole("link", { name: "Skip to main content" });

		expect(link).toHaveClass("focus:not-sr-only");
		expect(link).toHaveClass("focus:absolute");
		expect(link).toHaveClass("focus:top-0");
		expect(link).toHaveClass("focus:left-1/2");
		expect(link).toHaveClass("focus:transform");
		expect(link).toHaveClass("focus:-translate-x-1/2");
		expect(link).toHaveClass("focus:z-50");
		expect(link).toHaveClass("focus:px-4");
		expect(link).toHaveClass("focus:py-2");
		expect(link).toHaveClass("focus:bg-black");
		expect(link).toHaveClass("focus:text-white");
		expect(link).toHaveClass("focus:underline");
		expect(link).toHaveClass("focus:outline-none");
	});
});
