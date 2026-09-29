import { describe, expect, it } from "vitest";
import { resolveStyle } from "../parse-classes";

describe("resolveStyle", () => {
  it("reads size, spacing, radius and font together", () => {
    const style = resolveStyle(
      "h-9 gap-1.5 rounded-lg px-3 text-base bg-tomui-base text-tomui-default ring ring-tomui-line",
    );
    expect(style.height).toBe(36);
    expect(style.gap).toBe(6);
    expect(style.radius).toBe(8);
    expect(style.paddingRight).toBe(12);
    expect(style.fontSize).toBe(14);
    expect(style.strokeWidth).toBe(1);
    expect(style.fill).toEqual({ kind: "token", token: "--color-tomui-base", alpha: 1 });
    expect(style.textColor).toEqual({
      kind: "token",
      token: "--text-color-tomui-default",
      alpha: 1,
    });
    expect(style.stroke).toEqual({ kind: "token", token: "--color-tomui-line", alpha: 1 });
  });

  it("reads alpha suffixes", () => {
    const style = resolveStyle("text-tomui-default/70");
    expect(style.textColor).toEqual({
      kind: "token",
      token: "--text-color-tomui-default",
      alpha: 0.7,
    });
  });

  it("ignores state variants", () => {
    const style = resolveStyle(
      "hover:bg-tomui-tint disabled:opacity-50 not-disabled:hover:bg-tomui-fill",
    );
    expect(style.fill).toBeNull();
    expect(style.opacity).toBeNull();
  });

  it("reads literal colours", () => {
    const style = resolveStyle("text-white");
    expect(style.textColor).toEqual({
      kind: "literal",
      color: { r: 1, g: 1, b: 1, a: 1 },
    });
  });

  it("reads full radius and fractional sizes", () => {
    const style = resolveStyle("rounded-full size-3.5");
    expect(style.radius).toBe(9999);
    expect(style.width).toBe(14);
    expect(style.height).toBe(14);
  });

  it("reads dashed borders", () => {
    const style = resolveStyle("border border-dashed border-tomui-brand");
    expect(style.strokeDashed).toBe(true);
    expect(style.strokeWidth).toBe(1);
    expect(style.stroke).toEqual({ kind: "token", token: "--color-tomui-brand", alpha: 1 });
  });

  it("reads layout utilities", () => {
    const style = resolveStyle("flex flex-col items-center justify-between gap-2");
    expect(style.direction).toBe("column");
    expect(style.align).toBe("center");
    expect(style.justify).toBe("space-between");
    expect(style.gap).toBe(8);
  });
});
