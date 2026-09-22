/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core cell-signal-none. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const CellSignalNonePaths: IconPathData = {
  thin: [
    {
      d: "M44,192v8a4,4,0,0,1-8,0v-8a4,4,0,0,1,8,0Z",
    },
  ],
  light: [
    {
      d: "M46,192v8a6,6,0,0,1-12,0v-8a6,6,0,0,1,12,0Z",
    },
  ],
  regular: [
    {
      d: "M48,192v8a8,8,0,0,1-16,0v-8a8,8,0,0,1,16,0Z",
    },
  ],
  bold: [
    {
      d: "M52,192v8a12,12,0,0,1-24,0v-8a12,12,0,0,1,24,0Z",
    },
  ],
  fill: [
    {
      d: "M198.12,25.23a16,16,0,0,0-17.44,3.46l-160,160A16,16,0,0,0,32,216H192a16,16,0,0,0,16-16V40A15.94,15.94,0,0,0,198.12,25.23ZM192,200H32L192,40Z",
    },
  ],
  duotone: [
    {
      d: "M198.12,25.23a16,16,0,0,0-17.43,3.47l-160,160A16,16,0,0,0,32,216H192a16,16,0,0,0,16-16V40A16,16,0,0,0,198.12,25.23ZM192,200H32L192,40Z",
    },
  ],
};

/** CellSignalNone icon in six Phosphor weights. Defaults to regular weight. */
export function CellSignalNoneIcon(props: IconProps): JSX.Element {
  return <IconBase paths={CellSignalNonePaths} {...props} />;
}

export const CellSignalNone = CellSignalNoneIcon;
