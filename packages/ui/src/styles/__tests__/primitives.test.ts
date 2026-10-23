import { describe, expect, it } from "vitest";
import { cursor, layout, radius, select, spacing } from "../primitives.stylex";

/**
 * This module holds two kinds of thing, and the difference is load-bearing.
 *
 * A **value** is `defineConsts`, so a component can embed it in its own rule:
 * `borderRadius: radius.lg`. A **style** is `stylex.create`, so a component can
 * compose it whole: `stylex.attrs(styles.row, layout.itemsCenter)`.
 *
 * Reading a property off a style object — `radius.lg`, which is
 * what this module used to invite — compiles to a `var()` that nothing defines.
 * The browser drops the declaration and the property falls back to its initial
 * value, which is how every button lost its corners without anyone noticing.
 *
 * These assertions pin the split. They are not cosmetic: they are the reason
 * that mistake is now a type error rather than a silent rendering bug.
 */
describe("primitives", () => {
  it("exposes the value scales as plain lengths", () => {
    expect(radius.lg).toBe("0.5rem");
    expect(radius.full).toBe("9999px");
    expect(spacing.px2).toBe("0.5rem");
    expect(cursor.pointer).toBe("pointer");
    expect(select.none).toBe("none");
  });

  it("exposes the composable helpers as style objects", () => {
    expect(layout.itemsCenter).toBeTypeOf("object");
    expect(layout.gap1).toBeTypeOf("object");
  });
});
