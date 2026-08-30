import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { createRouter, memoryHistory } from "@solidjs/router";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "@tom/ui/ProgressBar";

function TestShell() {
  return (
    <>
      <ProgressBar />
      <a href="/about">About</a>
    </>
  );
}

const TestRouter = createRouter({
  history: memoryHistory("/"),
  routes: [
    { path: "/", component: TestShell },
    { path: "/about", component: () => <div>About</div> },
  ],
});

describe("ProgressBar", () => {
  it("is hidden before any navigation", () => {
    render(() => <TestRouter />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("appears during navigation and disappears afterwards", async () => {
    render(() => <TestRouter />);

    fireEvent.click(screen.getByRole("link", { name: "About" }));

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});
