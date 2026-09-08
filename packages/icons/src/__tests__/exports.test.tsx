import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { GoogleLogoIcon } from "@tom/icons/GoogleLogo";
import { IconBase } from "@tom/icons/IconBase";
import { GoogleIcon } from "@tom/icons/social/google";
import { DEFAULT_ICON_SIZE } from "@tom/icons/types";

describe("package exports", () => {
  it("resolves the requested import shapes", () => {
    expect(GoogleIcon).toBe(GoogleLogoIcon);
    expect(DEFAULT_ICON_SIZE).toBe("md");
    expect(IconBase).toBeDefined();
    render(() => <GoogleIcon data-testid="icon" />);
    expect(screen.getByTestId("icon").tagName.toLowerCase()).toBe("svg");
  });
});
