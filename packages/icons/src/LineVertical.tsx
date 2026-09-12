/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core line-vertical. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const LineVerticalPaths: IconPathData = {
  thin: [
    {
      d: "M132,24V232a4,4,0,0,1-8,0V24a4,4,0,0,1,8,0Z",
    },
  ],
  light: [
    {
      d: "M134,24V232a6,6,0,0,1-12,0V24a6,6,0,0,1,12,0Z",
    },
  ],
  regular: [
    {
      d: "M136,24V232a8,8,0,0,1-16,0V24a8,8,0,0,1,16,0Z",
    },
  ],
  bold: [
    {
      d: "M140,24V232a12,12,0,0,1-24,0V24a12,12,0,0,1,24,0Z",
    },
  ],
  fill: [
    {
      d: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM136,192a8,8,0,0,1-16,0V64a8,8,0,0,1,16,0Z",
    },
  ],
  duotone: [
    {
      d: "M224,48V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48Z",
      opacity: "0.2",
    },
    {
      d: "M136,24V232a8,8,0,0,1-16,0V24a8,8,0,0,1,16,0Z",
    },
  ],
};

/** LineVertical icon in six Phosphor weights. Defaults to regular weight. */
export function LineVerticalIcon(props: IconProps): JSX.Element {
  return <IconBase paths={LineVerticalPaths} {...props} />;
}

export const LineVertical = LineVerticalIcon;
