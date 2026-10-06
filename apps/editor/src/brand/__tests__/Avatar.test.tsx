import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Avatar, initialsFor } from "../Avatar";

describe("initialsFor", () => {
  it("takes first letters of the first two name words", () => {
    expect(initialsFor("Tom Hackshaw", "gh@tomhackshaw.com")).toBe("TH");
  });

  it("falls back to the email prefix without a name", () => {
    expect(initialsFor(null, "gh@tomhackshaw.com")).toBe("GH");
    expect(initialsFor(undefined, "gh@tomhackshaw.com")).toBe("GH");
  });

  it("uses two letters of a single-word name", () => {
    expect(initialsFor("Madonna", "m@example.com")).toBe("MA");
  });
});

describe("Avatar", () => {
  it("renders initials with an accessible label", () => {
    const { getByRole } = render(() => <Avatar name="Tom Hackshaw" email="gh@tomhackshaw.com" />);
    const avatar = getByRole("img", { name: "Tom Hackshaw" });
    expect(avatar.textContent).toBe("TH");
  });
});
