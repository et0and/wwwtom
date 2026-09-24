/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core caret-up. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const CaretUpPaths: IconPathData = {
  thin: [
    {
      d: "M210.83,162.83a4,4,0,0,1-5.66,0L128,85.66,50.83,162.83a4,4,0,0,1-5.66-5.66l80-80a4,4,0,0,1,5.66,0l80,80A4,4,0,0,1,210.83,162.83Z",
    },
  ],
  light: [
    {
      d: "M212.24,164.24a6,6,0,0,1-8.48,0L128,88.49,52.24,164.24a6,6,0,0,1-8.48-8.48l80-80a6,6,0,0,1,8.48,0l80,80A6,6,0,0,1,212.24,164.24Z",
    },
  ],
  regular: [
    {
      d: "M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z",
    },
  ],
  bold: [
    {
      d: "M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z",
    },
  ],
  fill: [
    {
      d: "M215.39,163.06A8,8,0,0,1,208,168H48a8,8,0,0,1-5.66-13.66l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,215.39,163.06Z",
    },
  ],
  duotone: [
    {
      d: "M208,160H48l80-80Z",
      opacity: "0.2",
    },
    {
      d: "M213.66,154.34l-80-80a8,8,0,0,0-11.32,0l-80,80A8,8,0,0,0,48,168H208a8,8,0,0,0,5.66-13.66ZM67.31,152,128,91.31,188.69,152Z",
    },
  ],
};

/** CaretUp icon in six Phosphor weights. Defaults to regular weight. */
export function CaretUpIcon(props: IconProps): JSX.Element {
  return <IconBase paths={CaretUpPaths} {...props} />;
}

export const CaretUp = CaretUpIcon;
