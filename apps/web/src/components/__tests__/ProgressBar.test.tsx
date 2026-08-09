import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { A, Route, Router } from "@solidjs/router";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "@tom/ui/ProgressBar";

function TestShell() {
  return (
    <>
      <ProgressBar />
      <A href="/about">About</A>
    </>
  );
}

describe("ProgressBar", () => {
  it("is hidden before any navigation", () => {
    render(() => (
      <Router>
        <Route path="/" component={TestShell} />
        <Route path="/about" component={() => <div>About</div>} />
      </Router>
    ));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("appears during navigation and disappears afterwards", async () => {
    render(() => (
      <Router>
        <Route path="/" component={TestShell} />
        <Route path="/about" component={() => <div>About</div>} />
      </Router>
    ));

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
