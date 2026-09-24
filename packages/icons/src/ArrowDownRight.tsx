/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core arrow-down-right. Regenerate with `pnpm --filter @tom/icons generate`.
 */

import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const ArrowDownRightPaths: IconPathData = {
  thin: [
    {
      d: "M196,88V192a4,4,0,0,1-4,4H88a4,4,0,0,1,0-8h94.34L61.17,66.83a4,4,0,0,1,5.66-5.66L188,182.34V88a4,4,0,0,1,8,0Z",
    },
  ],
  light: [
    {
      d: "M198,88V192a6,6,0,0,1-6,6H88a6,6,0,0,1,0-12h89.52L59.76,68.24a6,6,0,0,1,8.48-8.48L186,177.52V88a6,6,0,0,1,12,0Z",
    },
  ],
  regular: [
    {
      d: "M200,88V192a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h84.69L58.34,69.66A8,8,0,0,1,69.66,58.34L184,172.69V88a8,8,0,0,1,16,0Z",
    },
  ],
  bold: [
    {
      d: "M204,88V192a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h75L55.51,72.48a12,12,0,0,1,17-17L180,163V88a12,12,0,0,1,24,0Z",
    },
  ],
  fill: [
    {
      d: "M200,88V192a8,8,0,0,1-8,8H88a8,8,0,0,1-5.66-13.66L128.69,140,58.34,69.66A8,8,0,0,1,69.66,58.34L140,128.69l46.34-46.35A8,8,0,0,1,200,88Z",
    },
  ],
  duotone: [
    {
      d: "M192,88V192H88Z",
      opacity: "0.2",
    },
    {
      d: "M195.06,80.61a8,8,0,0,0-8.72,1.73L140,128.69,69.66,58.34A8,8,0,0,0,58.34,69.66L128.69,140,82.34,186.34A8,8,0,0,0,88,200H192a8,8,0,0,0,8-8V88A8,8,0,0,0,195.06,80.61ZM184,184H107.31l38.34-38.34h0L184,107.31Z",
    },
  ],
};

/** ArrowDownRight icon in six Phosphor weights. Defaults to regular weight. */
export function ArrowDownRightIcon(props: IconProps): JSX.Element {
  return <IconBase paths={ArrowDownRightPaths} {...props} />;
}

export const ArrowDownRight = ArrowDownRightIcon;
