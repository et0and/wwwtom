import { describe, expect, it } from "vitest";
import { cmsD1Name } from "../../cms/cms.storage.ts";

/**
 * Preview stages used to point at fixed dev database names with `retain()`, so
 * every PR shared real dev content and teardown could never delete it. The name
 * is the contract that keeps stages isolated. Tom R2 is dead, so the database
 * is the only Tom storage left to isolate.
 */

describe("cmsD1Name", () => {
  it("keeps the existing production database", () => {
    expect(cmsD1Name("production")).toBe("tom-cms-v2");
  });

  it("gives every preview stage its own database", () => {
    expect(cmsD1Name("pr-175")).toBe("wwwtom-cms-d1-pr-175");
    expect(cmsD1Name("pr-176")).toBe("wwwtom-cms-d1-pr-176");
  });

  it("leaves dev and staging on Alchemy's generated names", () => {
    expect(cmsD1Name("dev")).toBeUndefined();
    expect(cmsD1Name("staging")).toBeUndefined();
  });
});
