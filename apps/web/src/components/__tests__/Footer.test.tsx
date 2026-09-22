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
    expect(footer).toHaveTextContent("Accessibility. Webring.");
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
    const webringLink = screen.getByRole("link", { name: "Webring" });

    expect(webringLink).toBeInTheDocument();
    expect(webringLink).toHaveAttribute("href", "https://webring.xxiivv.com/#random");
  });

  it("links the release version to the commit", () => {
    render(() => <Footer version="3.8.1" commitHash="de7c16f" />);
    const versionLink = screen.getByRole("link", { name: "v3.8.1-de7c16f" });

    expect(versionLink).toBeInTheDocument();
    expect(versionLink).toHaveAttribute("href", "https://github.com/et0and/wwwtom/commit/de7c16f");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Webring. v3.8.1-de7c16f.");
  });

  it("hides the release version when the version is missing", () => {
    render(() => <Footer commitHash="de7c16f" />);

    expect(screen.queryByRole("link", { name: "vundefined-de7c16f" })).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("vundefined");
  });

  it("hides the release version when the commit hash is missing", () => {
    render(() => <Footer version="3.8.1" />);

    expect(screen.queryByRole("link", { name: "v3.8.1" })).not.toBeInTheDocument();
  });
});
