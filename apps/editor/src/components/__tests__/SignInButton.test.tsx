import { fireEvent, render } from "@solidjs/testing-library";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInButton } from "../SignInButton";

vi.mock("../../lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/session")>();
  return {
    ...actual,
    startSocialSignIn: () => Effect.never,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SignInButton", () => {
  it("shows a spinner and disables while signing in", async () => {
    const rendered = render(() => <SignInButton onError={() => {}} />);
    const button = rendered.getByRole("button", { name: /sign in with/i });

    expect(button).not.toBeDisabled();
    expect(rendered.queryByTestId("waiting-spinner")).toBeNull();

    fireEvent.click(button);

    await rendered.findByTestId("waiting-spinner");
    expect(button).toBeDisabled();
    expect(button.className).toContain("active:brightness-95");
  });
});
