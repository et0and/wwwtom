import { render, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile, type TurnstileRenderOptions } from "../Turnstile";

const renderWidget = vi.fn<(element: HTMLElement, options: TurnstileRenderOptions) => string>(
  () => "widget-1",
);
const removeWidget = vi.fn();

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITEKEY", "test-sitekey");
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    value: { render: renderWidget, remove: removeWidget },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("renders a widget with the sitekey and action", async () => {
    const onToken = vi.fn();
    render(() => <Turnstile action="guestbook-sign" onToken={onToken} />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        sitekey: "test-sitekey",
        action: "guestbook-sign",
      }),
    );
    // The script is already loaded (stubbed) — nothing injected.
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
  });

  it("reports the token through onToken", async () => {
    const onToken = vi.fn();
    render(() => <Turnstile action="guestbook-sign" onToken={onToken} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalled());

    const options = renderWidget.mock.calls[0]?.[1];
    options?.callback?.("token-123");
    expect(onToken).toHaveBeenCalledWith("token-123");
  });

  it("renders a fresh widget when attempt changes", async () => {
    const onToken = vi.fn();
    const [attempt, setAttempt] = createSignal(0);
    render(() => <Turnstile action="guestbook-sign" attempt={attempt()} onToken={onToken} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));

    setAttempt(1);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-1");
  });

  it("renders nothing when the sitekey is unset", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITEKEY", undefined);
    render(() => <Turnstile action="guestbook-sign" onToken={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderWidget).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
  });
});
