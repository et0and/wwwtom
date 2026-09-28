import { describe, expect, it } from "vitest";
import { parseThemeCss } from "../theme";

const fixture = `
@theme {
  --text-base: 14px;
  --text-base--line-height: 1.5;
  --text-sm: 13px;
  --text-sm--line-height: calc(1 / 0.85);
}

@layer base {
  :root,
  [data-theme="tomui"] {
    --color-tomui-base: #fff;
    --color-tomui-brand: oklch(60% 0.2 260);
    --text-color-tomui-default: var(--color-neutral-900, #111);
  }

  :root[data-mode="dark"],
  [data-theme="tomui"][data-mode="dark"] {
    --color-tomui-base: #111;
    --color-tomui-brand: color-mix(in oklch, oklch(60% 0.2 260), black 10%);
    --text-color-tomui-default: #eee;
  }
}
`;

describe("parseThemeCss", () => {
  it("keeps only TomUI colour tokens", () => {
    const theme = parseThemeCss(fixture);
    const names = theme.colors.map((token) => token.name);
    expect(names).toEqual([
      "--color-tomui-base",
      "--color-tomui-brand",
      "--text-color-tomui-default",
    ]);
  });

  it("resolves distinct light and dark values", () => {
    const theme = parseThemeCss(fixture);
    const base = theme.colors.find((token) => token.name === "--color-tomui-base");
    expect(base?.light).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(base?.dark.r).toBeCloseTo(1 / 15, 5);
    expect(base?.dark.a).toBe(1);
  });

  it("reads font sizes across theme blocks", () => {
    const theme = parseThemeCss(fixture);
    expect(theme.fontSizes).toEqual([
      { name: "base", size: 14, lineHeight: 21 },
      { name: "sm", size: 13, lineHeight: 13 / 0.85 },
    ]);
  });
});
