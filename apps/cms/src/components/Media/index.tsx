import React, { Fragment } from "react";

import type { Props } from "./types";

import { ImageMedia } from "./ImageMedia";
import { VideoMedia } from "./VideoMedia";

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = "div", resource } = props;

  const isVideo = resource instanceof Object && resource.mimeType?.includes("video");
  const Tag = htmlElement || Fragment;

  return (
    <Tag
      {...(htmlElement !== null
        ? {
            className,
          }
        : {})}
    >
      {isVideo ? <VideoMedia {...props} /> : <ImageMedia {...props} />}
    </Tag>
  );
};
