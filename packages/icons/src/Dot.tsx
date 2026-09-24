/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core dot. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const DotPaths: IconPathData = {
  thin: [
    {
      d: "M136,128a8,8,0,1,1-8-8A8,8,0,0,1,136,128Z",
    },
  ],
  light: [
    {
      d: "M138,128a10,10,0,1,1-10-10A10,10,0,0,1,138,128Z",
    },
  ],
  regular: [
    {
      d: "M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z",
    },
  ],
  bold: [
    {
      d: "M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128Z",
    },
  ],
  fill: [
    {
      d: "M128,80a48,48,0,1,0,48,48A48,48,0,0,0,128,80Zm0,60a12,12,0,1,1,12-12A12,12,0,0,1,128,140Z",
    },
  ],
  duotone: [
    {
      d: "M176,128a48,48,0,1,1-48-48A48,48,0,0,1,176,128Z",
      opacity: "0.2",
    },
    {
      d: "M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Z",
    },
  ],
};

/** Dot icon in six Phosphor weights. Defaults to regular weight. */
export function DotIcon(props: IconProps): JSX.Element {
  return <IconBase paths={DotPaths} {...props} />;
}

export const Dot = DotIcon;
