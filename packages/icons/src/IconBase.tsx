import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import {
  DEFAULT_ICON_COLOR,
  DEFAULT_ICON_SIZE,
  DEFAULT_ICON_WEIGHT,
  iconColorValue,
  iconSizePx,
  type IconBaseProps,
  type IconPath,
} from "./types.ts";

/**
 * Base renderer for all icons. Instantiates the paths for the active weight
 * on each render and paints them with the resolved size and color tokens.
 * Children render below the icon paths, so callers can add background
 * layers or animation.
 */
export function IconBase(props: IconBaseProps): JSX.Element {
  const merged = merge(
    {
      size: DEFAULT_ICON_SIZE,
      color: DEFAULT_ICON_COLOR,
      weight: DEFAULT_ICON_WEIGHT,
      mirrored: false,
    },
    props,
  );
  const rest = omit(
    merged,
    "size",
    "color",
    "weight",
    "mirrored",
    "title",
    "children",
    "paths",
    "class",
  );
  const sizePx = (): number => iconSizePx(merged.size);
  const fill = (): string => iconColorValue(merged.color);
  // Fall back to the default weight so plain-JS callers passing an
  // unknown weight still get a rendered icon instead of no paths.
  const paths = (): ReadonlyArray<IconPath> =>
    merged.paths[merged.weight] ?? merged.paths[DEFAULT_ICON_WEIGHT];
  const title = (): string | undefined => {
    const trimmed = merged.title?.trim();
    return trimmed === undefined || trimmed === "" ? undefined : trimmed;
  };
  const flip = (): string | undefined =>
    merged.mirrored ? "translate(256, 0) scale(-1, 1)" : undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={sizePx()}
      height={sizePx()}
      fill={fill()}
      aria-hidden={title() === undefined ? "true" : undefined}
      role={title() === undefined ? undefined : "img"}
      class={merged.class}
      {...rest}
    >
      <Show when={title()}>{(text) => <title>{text()}</title>}</Show>
      <g transform={flip()}>
        {merged.children}
        <For each={paths()}>{(path) => <path d={path.d} opacity={path.opacity} />}</For>
      </g>
    </svg>
  );
}
