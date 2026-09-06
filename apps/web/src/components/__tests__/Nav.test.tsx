import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { createRouter, memoryHistory } from "@solidjs/router";
import { Nav } from "@tom/ui/Nav";

const createTestRouter = () =>
  createRouter({
    history: memoryHistory("/"),
    routes: [
      { path: "/", component: Nav },
      { path: "/work", component: Nav },
    ],
  });

describe("Nav", () => {
  it("matches the snapshot", () => {
    const TestRouter = createTestRouter();
    const { container } = render(() => <TestRouter />);
    expect(container).toMatchSnapshot();
  });

  it("renders main navigation links", () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);

    expect(screen.getByRole("link", { name: "Tom Hackshaw" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Writing" })).toBeInTheDocument();
  });

  it("has correct href attributes for navigation links", () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);

    expect(screen.getByRole("link", { name: "Tom Hackshaw" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/work");
    expect(screen.getByRole("link", { name: "Writing" })).toHaveAttribute("href", "/posts");
  });

  it("contains mobile menu toggle button", () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    const toggleButton = screen.getByRole("button", { name: "Toggle menu" });

    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveClass("md:hidden");
  });

  it("opens menu on click", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));

    await waitFor(() => expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(2));
  });

  it("closes menu on second toggle click", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));

    await waitFor(() => expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(1));
  });

  it("navigates to Work on click", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(2));

    const links = screen.getAllByRole("link", { name: "Work" });
    const dropdownWork = links[1];
    expect(dropdownWork).toHaveAttribute("href", "/work");
  });

  it("opens menu with keyboard", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    const toggleButton = screen.getByRole("button", { name: "Toggle menu" });
    toggleButton.focus();
    expect(document.activeElement).toBe(toggleButton);

    fireEvent.click(document.activeElement as HTMLElement);

    await waitFor(() => expect(screen.getAllByRole("link", { name: "Work" })).toHaveLength(2));
  });
});
