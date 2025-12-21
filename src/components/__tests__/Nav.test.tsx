import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { Router, Route } from "@solidjs/router";
import Nav from "../Nav";

describe("Nav", () => {
	it("matches the snapshot", () => {
		const { container } = render(() => (
			<Router>
				<Route path="/" component={Nav} />
			</Router>
		));
		expect(container).toMatchSnapshot();
	});

	it("renders main navigation links", () => {
		render(() => (
			<Router>
				<Route path="/" component={Nav} />
			</Router>
		));

		expect(
			screen.getByRole("link", { name: "Tom Hackshaw" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Writing" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Guestbook" })).toBeInTheDocument();
	});

	it("has correct href attributes for navigation links", () => {
		render(() => (
			<Router>
				<Route path="/" component={Nav} />
			</Router>
		));

		expect(screen.getByRole("link", { name: "Tom Hackshaw" })).toHaveAttribute(
			"href",
			"/",
		);
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
		expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
			"href",
			"/search",
		);
		expect(screen.getByRole("link", { name: "Guestbook" })).toHaveAttribute(
			"href",
			"/guestbook",
		);
	});

	it("has correct nav styling classes", () => {
		render(() => (
			<Router>
				<Route path="/" component={Nav} />
			</Router>
		));
		const nav = screen.getByRole("navigation");

		expect(nav).toHaveClass("relative");
		expect(nav).toHaveClass("tracking-tighter");
		expect(nav).toHaveClass("px-6");
		expect(nav).toHaveClass("py-4");
		expect(nav).toHaveClass("flex-shrink-0");
	});

	it("contains mobile menu toggle button", () => {
		render(() => (
			<Router>
				<Route path="/" component={Nav} />
			</Router>
		));
		const toggleButton = screen.getByRole("button", { name: "Toggle menu" });

		expect(toggleButton).toBeInTheDocument();
		expect(toggleButton).toHaveClass("md:hidden");
	});
});
