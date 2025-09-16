import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import Nav from "~/components/Nav";

describe("Nav", () => {
	it("renders main navigation links", () => {
		render(() => <Nav />);

		expect(
			screen.getByRole("link", { name: "Tom Hackshaw Tom Hackshaw" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Writing" })).toBeInTheDocument();
	});

	it("has correct href attributes for navigation links", () => {
		render(() => <Nav />);

		expect(
			screen.getByRole("link", { name: "Tom Hackshaw Tom Hackshaw" }),
		).toHaveAttribute("href", "/");
		expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
			"href",
			"/about",
		);
		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
			"href",
			"/work",
		);
		expect(screen.getByRole("link", { name: "Writing" })).toHaveAttribute(
			"href",
			"/posts",
		);
	});

	it("has correct nav styling classes", () => {
		render(() => <Nav />);
		const nav = screen.getByRole("navigation");

		expect(nav).toHaveClass("flex");
		expect(nav).toHaveClass("items-center");
		expect(nav).toHaveClass("tracking-tighter");
		expect(nav).toHaveClass("justify-between");
		expect(nav).toHaveClass("h-16");
		expect(nav).toHaveClass("px-6");
		expect(nav).toHaveClass("py-4");
		expect(nav).toHaveClass("flex-shrink-0");
	});

	it("contains screen reader text for mobile logo", () => {
		render(() => <Nav />);
		const srOnlyTexts = screen.getAllByText("Tom Hackshaw");
		const srOnlyText = srOnlyTexts.find((el) =>
			el.classList.contains("sr-only"),
		);

		expect(srOnlyText).toHaveClass("sr-only");
	});
});
