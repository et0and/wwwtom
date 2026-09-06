import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { Footer } from "@tom/ui/Footer";

describe("Footer", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => <Footer />);
    expect(container).toMatchSnapshot();
  });

  it("renders with current year", () => {
    const currentYear = new Date().getFullYear();
    render(() => <Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(`© ${currentYear}`);
    expect(footer).toHaveTextContent("Accessibility. This site is part of a webring.");
  });

  it("contains accessibility link", () => {
    render(() => <Footer />);
    const accessibilityLink = screen.getByRole("link", {
      name: "Accessibility",
    });

    expect(accessibilityLink).toBeInTheDocument();
    expect(accessibilityLink).toHaveAttribute("href", "/accessibility");
  });

  it("contains webring link", () => {
    render(() => <Footer />);
    const webringLink = screen.getByRole("link", { name: "webring" });

    expect(webringLink).toBeInTheDocument();
    expect(webringLink).toHaveAttribute("href", "https://webring.xxiivv.com/#random");
  });
});
