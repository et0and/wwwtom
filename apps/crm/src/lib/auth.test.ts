import { describe, expect, it } from "vitest";
import { callbackUrlFromLocation } from "./auth";

describe("CRM callback URL", () => {
  it("preserves the scanned asset query", () => {
    expect(
      callbackUrlFromLocation({
        origin: "https://crm.tom.so",
        pathname: "/",
        search: "?asset=00000000-0000-4000-8000-000000000001",
        hash: "",
      }),
    ).toBe("https://crm.tom.so/?asset=00000000-0000-4000-8000-000000000001");
  });
});
