/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core divide. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const DividePaths: IconPathData = {
  thin: [
    {
      d: "M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128ZM128,76a12,12,0,1,0-12-12A12,12,0,0,0,128,76Zm0,104a12,12,0,1,0,12,12A12,12,0,0,0,128,180Z",
    },
  ],
  light: [
    {
      d: "M222,128a6,6,0,0,1-6,6H40a6,6,0,0,1,0-12H216A6,6,0,0,1,222,128ZM128,78a14,14,0,1,0-14-14A14,14,0,0,0,128,78Zm0,100a14,14,0,1,0,14,14A14,14,0,0,0,128,178Z",
    },
  ],
  regular: [
    {
      d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM128,80a16,16,0,1,0-16-16A16,16,0,0,0,128,80Zm0,96a16,16,0,1,0,16,16A16,16,0,0,0,128,176Z",
    },
  ],
  bold: [
    {
      d: "M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM128,84a20,20,0,1,0-20-20A20,20,0,0,0,128,84Zm0,88a20,20,0,1,0,20,20A20,20,0,0,0,128,172Z",
    },
  ],
  fill: [
    {
      d: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM128,64a16,16,0,1,1-16,16A16,16,0,0,1,128,64Zm0,128a16,16,0,1,1,16-16A16,16,0,0,1,128,192Zm56-56H72a8,8,0,0,1,0-16H184a8,8,0,0,1,0,16Z",
    },
  ],
  duotone: [
    {
      d: "M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z",
      opacity: "0.2",
    },
    {
      d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM128,80a16,16,0,1,0-16-16A16,16,0,0,0,128,80Zm0,96a16,16,0,1,0,16,16A16,16,0,0,0,128,176Z",
    },
  ],
};

/** Divide icon in six Phosphor weights. Defaults to regular weight. */
export function DivideIcon(props: IconProps): JSX.Element {
  return <IconBase paths={DividePaths} {...props} />;
}

export const Divide = DivideIcon;
