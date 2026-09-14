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

  it("contains a mobile Menu trigger", () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    const trigger = screen.getByRole("button", { name: "Menu" });

    expect(trigger).toBeInTheDocument();
    expect(trigger.closest("[class~='md:hidden']")).not.toBeNull();
  });

  it("opens menu on click", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    expect(screen.queryByRole("menuitem", { name: "Work" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Work" })).toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: "Writing" })).toBeInTheDocument();
  });

  it("locks page scroll while the mobile menu is open", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("restores page scroll when the mobile menu closes", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    await waitFor(() => expect(document.body.style.overflow).toBe(""));
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes menu on second trigger click", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Work" })).toBeInTheDocument());

    fireEvent.mouseDown(trigger);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("menuitem", { name: "Work" })).toBeInTheDocument();

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Work" })).not.toBeInTheDocument(),
    );
  });

  it("links menu items to their routes", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Work" })).toHaveAttribute("href", "/work"),
    );
    expect(screen.getByRole("menuitem", { name: "Writing" })).toHaveAttribute("href", "/posts");
  });

  it("closes menu and unlocks scroll after selecting a menu item", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Work" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("menuitem", { name: "Work" }));

    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Work" })).not.toBeInTheDocument(),
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("opens menu with keyboard", async () => {
    const TestRouter = createTestRouter();
    render(() => <TestRouter />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(document.activeElement as HTMLElement);

    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Work" })).toBeInTheDocument());
  });
});
