import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { Spinner } from "@tom/ui/Spinner";

describe("Spinner", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => <Spinner />);
    expect(container).toMatchSnapshot();
  });

  it("renders a waiting indicator", () => {
    render(() => <Spinner />);

    expect(screen.getByTestId("waiting-spinner")).toBeInTheDocument();
  });

  it("passes a custom class through", () => {
    render(() => <Spinner class="extra" />);

    expect(screen.getByTestId("waiting-spinner").querySelector("svg")).toHaveClass("extra");
  });
});
