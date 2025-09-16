import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import Counter from "~/components/Counter";

describe("Counter", () => {
	it("renders with initial count of 0", () => {
		render(() => <Counter />);
		expect(screen.getByText("Clicks: 0")).toBeInTheDocument();
	});

	it("increments count when button is clicked", () => {
		render(() => <Counter />);
		const button = screen.getByRole("button", { name: /clicks: \d+/i });

		fireEvent.click(button);
		expect(screen.getByText("Clicks: 1")).toBeInTheDocument();

		fireEvent.click(button);
		expect(screen.getByText("Clicks: 2")).toBeInTheDocument();
	});

	it("has the correct button styling classes", () => {
		render(() => <Counter />);
		const button = screen.getByRole("button");

		expect(button).toHaveClass("w-[200px]");
		expect(button).toHaveClass("rounded-full");
		expect(button).toHaveClass("bg-gray-100");
		expect(button).toHaveClass("border-2");
		expect(button).toHaveClass("border-gray-300");
		expect(button).toHaveClass("px-[2rem]");
		expect(button).toHaveClass("py-[1rem]");
	});
});
