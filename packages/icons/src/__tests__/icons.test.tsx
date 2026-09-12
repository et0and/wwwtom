import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { CellSignalNoneIcon } from "../CellSignalNone.tsx";
import * as FileModule from "../File.tsx";
import * as FunctionModule from "../Function.tsx";
import { GoogleLogoIcon } from "../GoogleLogo.tsx";
import { IconBase } from "../IconBase.tsx";
import * as ImageModule from "../Image.tsx";
import * as InfinityModule from "../Infinity.tsx";
import * as OptionModule from "../Option.tsx";
import * as ScrollModule from "../Scroll.tsx";
import { GoogleIcon } from "../social/google.tsx";
import { XLogoIcon as SocialXLogoIcon } from "../social/x.tsx";
import * as StopModule from "../Stop.tsx";
import {
  DEFAULT_ICON_COLOR,
  DEFAULT_ICON_SIZE,
  DEFAULT_ICON_WEIGHT,
  iconColorValue,
  iconSizePx,
  type IconPathData,
  type IconWeight,
} from "../types.ts";
import { WifiNoneIcon } from "../WifiNone.tsx";
import { XLogoIcon } from "../XLogo.tsx";
import { XIcon } from "../X.tsx";

const pathFor = (d: string): IconPathData => ({
  thin: [{ d: `thin-${d}` }],
  light: [{ d: `light-${d}` }],
  regular: [{ d: `regular-${d}` }],
  bold: [{ d: `bold-${d}` }],
  fill: [{ d: `fill-${d}` }],
  duotone: [{ d: `duotone-${d}` }],
});

const testWeights: IconPathData = pathFor("test");

const firstPathD = (container: HTMLElement): string | null =>
  container.querySelector("path")?.getAttribute("d") ?? null;

describe("icon tokens", () => {
  it("maps size tokens to pixels", () => {
    expect(iconSizePx("xs")).toBe(12);
    expect(iconSizePx("sm")).toBe(16);
    expect(iconSizePx("md")).toBe(20);
    expect(iconSizePx("lg")).toBe(24);
    expect(iconSizePx("xl")).toBe(32);
    expect(iconSizePx("2xl")).toBe(48);
  });

  it("maps color tokens to values", () => {
    expect(iconColorValue("current")).toBe("currentColor");
    expect(iconColorValue("white")).toBe("#ffffff");
    expect(iconColorValue("black")).toBe("#000000");
    expect(iconColorValue("brand")).toContain("tomui");
  });

  it("uses sensible defaults", () => {
    expect(DEFAULT_ICON_SIZE).toBe("md");
    expect(DEFAULT_ICON_COLOR).toBe("current");
    expect(DEFAULT_ICON_WEIGHT).toBe("regular");
  });
});

describe("IconBase", () => {
  it("renders defaults without props", () => {
    const { container } = render(() => <IconBase paths={testWeights} data-testid="icon" />);
    const svg = screen.getByTestId("icon");

    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector("g")).not.toHaveAttribute("transform");
    expect(firstPathD(container)).toBe("regular-test");
  });

  it("applies size, color, weight, and mirrored props", () => {
    render(() => (
      <IconBase
        paths={testWeights}
        size="lg"
        color="white"
        weight="fill"
        mirrored
        data-testid="icon"
      />
    ));
    const svg = screen.getByTestId("icon");

    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveAttribute("fill", "#ffffff");
    expect(svg.querySelector("g")).toHaveAttribute("transform", "translate(256, 0) scale(-1, 1)");
    expect(svg.querySelector("path")).toHaveAttribute("d", "fill-test");
  });

  it("renders each weight", () => {
    const weights: Array<IconWeight> = ["thin", "light", "regular", "bold", "fill", "duotone"];
    for (const weight of weights) {
      const { container, unmount } = render(() => <IconBase paths={testWeights} weight={weight} />);
      expect(firstPathD(container)).toBe(`${weight}-test`);
      unmount();
    }
  });

  it("exposes a title for assistive tech", () => {
    render(() => <IconBase paths={testWeights} title="Search" data-testid="icon" />);
    const svg = screen.getByTestId("icon");

    expect(svg).toHaveAttribute("role", "img");
    expect(svg).not.toHaveAttribute("aria-hidden");
    expect(svg.querySelector("title")).toHaveTextContent("Search");
  });

  it("renders children below the icon paths", () => {
    render(() => (
      <IconBase paths={testWeights} data-testid="icon">
        <circle cx="128" cy="128" r="10" />
      </IconBase>
    ));
    const svg = screen.getByTestId("icon");
    const group = svg.querySelector("g");

    expect(svg.querySelector("circle")).toBeInTheDocument();
    expect(group?.children[0]?.tagName.toLowerCase()).toBe("circle");
    expect(group?.children[1]?.tagName.toLowerCase()).toBe("path");
  });

  it("passes class and extra svg props through", () => {
    render(() => <IconBase paths={testWeights} class="extra" data-testid="icon" opacity="0.5" />);
    const svg = screen.getByTestId("icon");

    expect(svg).toHaveClass("extra");
    expect(svg).toHaveAttribute("opacity", "0.5");
  });
});

describe("GoogleLogoIcon", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => <GoogleLogoIcon />);
    expect(container).toMatchSnapshot();
  });

  it("supports the requested size and color props", () => {
    render(() => <GoogleLogoIcon size="md" color="white" data-testid="icon" />);
    const svg = screen.getByTestId("icon");

    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("fill", "#ffffff");
  });

  it("renders different paths per weight", () => {
    const { container: thin } = render(() => <GoogleLogoIcon weight="thin" />);
    const { container: fill } = render(() => <GoogleLogoIcon weight="fill" />);
    const thinD = firstPathD(thin);
    const fillD = firstPathD(fill);

    expect(thinD).toBeTruthy();
    expect(fillD).toBeTruthy();
    expect(thinD).not.toBe(fillD);
    expect(thin.querySelectorAll("path")).toHaveLength(1);
  });

  it("rejects arbitrary sizes at compile time", () => {
    // @ts-expect-error - size accepts tokens only
    render(() => <GoogleLogoIcon size="huge" />);
  });

  it("rejects arbitrary colors at compile time", () => {
    // @ts-expect-error - color accepts tokens only
    render(() => <GoogleLogoIcon color="hotpink" />);
  });

  it("rejects arbitrary weights at compile time", () => {
    // @ts-expect-error - weight accepts Phosphor weights only
    render(() => <GoogleLogoIcon weight="heavy" />);
  });
});

describe("social aliases", () => {
  it("renders the same icon as the canonical component", () => {
    const { container: alias } = render(() => <GoogleIcon />);
    const { container: canonical } = render(() => <GoogleLogoIcon />);
    const aliasD = firstPathD(alias);
    const canonicalD = firstPathD(canonical);

    expect(aliasD).toBeTruthy();
    expect(aliasD).toBe(canonicalD);
  });

  it("keeps the X close icon and the X brand logo distinct", () => {
    expect(XIcon).not.toBe(XLogoIcon);
    expect(SocialXLogoIcon).toBe(XLogoIcon);

    const { container: close } = render(() => <XIcon />);
    const { container: logo } = render(() => <SocialXLogoIcon />);

    expect(firstPathD(close)).toBeTruthy();
    expect(firstPathD(logo)).toBeTruthy();
    expect(firstPathD(close)).not.toBe(firstPathD(logo));
  });
});

describe("runtime fallbacks", () => {
  it("falls back to defaults for unknown tokens", () => {
    // @ts-expect-error - unknown tokens fall back at runtime for JS callers
    expect(iconSizePx("huge")).toBe(20);
    // @ts-expect-error - unknown tokens fall back at runtime for JS callers
    expect(iconColorValue("hotpink")).toBe("currentColor");
  });

  it("falls back to regular for unknown weights", () => {
    const { container } = render(() => (
      // @ts-expect-error - unknown weights fall back to regular at runtime
      <IconBase paths={testWeights} weight="heavy" />
    ));

    expect(firstPathD(container)).toBe("regular-test");
  });

  it("treats a blank title as decorative", () => {
    render(() => <IconBase paths={testWeights} title=" " data-testid="blank" />);
    render(() => <IconBase paths={testWeights} title="" data-testid="empty" />);
    const blank = screen.getByTestId("blank");
    const empty = screen.getByTestId("empty");

    expect(blank).toHaveAttribute("aria-hidden", "true");
    expect(blank).not.toHaveAttribute("role");
    expect(blank.querySelector("title")).not.toBeInTheDocument();
    expect(empty).toHaveAttribute("aria-hidden", "true");
    expect(empty.querySelector("title")).not.toBeInTheDocument();
  });
});

describe("global-name blocklist", () => {
  it("emits no short alias for names that shadow globals", () => {
    expect(Object.keys(FileModule)).toEqual(["FileIcon"]);
    expect(Object.keys(FunctionModule)).toEqual(["FunctionIcon"]);
    expect(Object.keys(ImageModule)).toEqual(["ImageIcon"]);
    expect(Object.keys(InfinityModule)).toEqual(["InfinityIcon"]);
    expect(Object.keys(OptionModule)).toEqual(["OptionIcon"]);
    expect(Object.keys(ScrollModule)).toEqual(["ScrollIcon"]);
    expect(Object.keys(StopModule)).toEqual(["StopIcon"]);
  });
});

describe("single-path duotone icons", () => {
  it("renders the one duotone path", () => {
    const { container: wifi } = render(() => <WifiNoneIcon weight="duotone" />);
    const { container: cell } = render(() => <CellSignalNoneIcon weight="duotone" />);

    expect(wifi.querySelectorAll("path")).toHaveLength(1);
    expect(cell.querySelectorAll("path")).toHaveLength(1);
  });
});
