import { fireEvent, render } from "@solidjs/testing-library";
import { createMemo, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

describe("solid reactivity sanity", () => {
  it("re-renders JSX on signal change", async () => {
    const [v, setV] = createSignal(0);
    const Probe = () => <p>{v()}</p>;
    const { findByText } = render(() => <Probe />);
    expect(await findByText("0")).toBeInTheDocument();
    setV(1);
    expect(await findByText("1")).toBeInTheDocument();
  });

  it("updates memos on signal change", async () => {
    const [v, setV] = createSignal(0);
    const Probe = () => {
      const doubled = createMemo(() => v() * 2);
      return <p>{doubled()}</p>;
    };
    const { findByText } = render(() => <Probe />);
    expect(await findByText("0")).toBeInTheDocument();
    setV(1);
    expect(await findByText("2")).toBeInTheDocument();
  });

  it("tracks helper function calls in JSX", async () => {
    const [v, setV] = createSignal(0);
    const label = (): string => `n${v()}`;
    const Probe = () => <p>{label()}</p>;
    const { findByText } = render(() => <Probe />);
    expect(await findByText("n0")).toBeInTheDocument();
    setV(1);
    expect(await findByText("n1")).toBeInTheDocument();
  });

  it("notifies writes made inside click handlers", async () => {
    const [v, setV] = createSignal(0);
    const Probe = () => (
      <button type="button" onClick={() => setV(v() + 1)}>
        {v()}
      </button>
    );
    const { findByRole } = render(() => <Probe />);
    fireEvent.click(await findByRole("button"));
    expect(await findByRole("button")).toHaveTextContent("1");
    fireEvent.click(await findByRole("button"));
    expect(await findByRole("button")).toHaveTextContent("2");
  });
});
