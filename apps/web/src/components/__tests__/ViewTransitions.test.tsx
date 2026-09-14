import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRouter, memoryHistory } from "@solidjs/router";
import { ViewTransitions } from "@tom/ui/ViewTransitions";

const createTestRouter = () =>
  createRouter({
    history: memoryHistory("/"),
    routes: [
      { path: "/", component: () => <a href="/work">Work</a> },
      { path: "/work", component: () => <p>Work page</p> },
    ],
  });

const createViewTransitionStub = (): ViewTransition => ({
  finished: Promise.resolve(),
  ready: Promise.resolve(),
  types: new Set<string>(),
  updateCallbackDone: Promise.resolve(),
  skipTransition: () => {},
});

const stubViewTransition = () => {
  const startViewTransition = vi.fn((callback: () => void) => {
    callback();
    return createViewTransitionStub();
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: startViewTransition,
  });
  return startViewTransition;
};

const stubReducedMotion = () => {
  const original = window.matchMedia;
  window.matchMedia = (() => ({ matches: true }) as MediaQueryList) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

const renderWithTransitions = () => {
  const TestRouter = createTestRouter();
  render(() => (
    <TestRouter>{(props) => <ViewTransitions>{props.children}</ViewTransitions>}</TestRouter>
  ));
};

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("ViewTransitions", () => {
  it("navigates internal links inside document.startViewTransition", async () => {
    const startViewTransition = stubViewTransition();
    renderWithTransitions();

    expect(fireEvent.click(screen.getByRole("link", { name: "Work" }))).toBe(false);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Work page")).toBeInTheDocument());
  });

  it("navigates without the API when the browser lacks it", async () => {
    renderWithTransitions();

    fireEvent.click(screen.getByRole("link", { name: "Work" }));

    await waitFor(() => expect(screen.getByText("Work page")).toBeInTheDocument());
  });

  it("leaves hash-only jumps to the router", () => {
    const startViewTransition = stubViewTransition();
    const TestRouter = createRouter({
      history: memoryHistory("/"),
      routes: [{ path: "/", component: () => <a href="#main">Skip</a> }],
    });
    render(() => (
      <TestRouter>{(props) => <ViewTransitions>{props.children}</ViewTransitions>}</TestRouter>
    ));

    fireEvent.click(screen.getByRole("link", { name: "Skip" }));

    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("wraps navigations that carry router state", () => {
    const startViewTransition = stubViewTransition();
    const TestRouter = createRouter({
      history: memoryHistory("/"),
      routes: [
        {
          path: "/",
          component: () => (
            <a href="/work" {...{ state: "{}" }}>
              Work
            </a>
          ),
        },
        { path: "/work", component: () => <p>Work page</p> },
      ],
    });
    render(() => (
      <TestRouter>{(props) => <ViewTransitions>{props.children}</ViewTransitions>}</TestRouter>
    ));

    fireEvent.click(screen.getByRole("link", { name: "Work" }));

    expect(startViewTransition).toHaveBeenCalledTimes(1);
  });

  it("leaves modified clicks to the browser", () => {
    const startViewTransition = stubViewTransition();
    const preventNavigation = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", preventNavigation);

    try {
      renderWithTransitions();
      fireEvent.click(screen.getByRole("link", { name: "Work" }), { metaKey: true });

      expect(startViewTransition).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", preventNavigation);
    }
  });

  it("skips the transition when reduced motion is preferred", () => {
    const startViewTransition = stubViewTransition();
    const restoreMatchMedia = stubReducedMotion();
    const preventNavigation = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", preventNavigation);

    try {
      renderWithTransitions();
      fireEvent.click(screen.getByRole("link", { name: "Work" }));

      expect(startViewTransition).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", preventNavigation);
      restoreMatchMedia();
    }
  });
});
