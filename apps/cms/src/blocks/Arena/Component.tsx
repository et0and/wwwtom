import React from "react";
import type { ArenaBlock as ArenaBlockProps } from "@/payload-types";

type Props = ArenaBlockProps & {
  className?: string;
  disableInnerContainer?: boolean;
};

export const ArenaBlock: React.FC<Props> = (props) => {
  const { arenaSlug, arenaTitle, className } = props;

  if (!arenaSlug) {
    return null;
  }

  return (
    <div className={className}>
      <div className="arena-embed" data-slug={arenaSlug} data-title={arenaTitle} />
    </div>
  );
};
