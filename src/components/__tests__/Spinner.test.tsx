import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { Spinner } from "../Spinner";

describe("Spinner", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => <Spinner />);
    expect(container).toMatchSnapshot();
  });
});
