import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { SkipLink } from "@tom/ui/SkipLink";

describe("SkipLink", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => <SkipLink />);
    expect(container).toMatchSnapshot();
  });

  it("renders skip link with correct text", () => {
    render(() => <SkipLink />);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toBeInTheDocument();
  });

  it("has correct href attribute", () => {
    render(() => <SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });

    expect(link).toHaveAttribute("href", "#main");
  });

  it("receives keyboard focus", () => {
    render(() => <SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    link.focus();

    expect(document.activeElement).toBe(link);
  });
});
