import React, { Fragment } from "react";

import type { Props } from "./types";

import { ImageMedia } from "./ImageMedia";
import { VideoMedia } from "./VideoMedia";
import { isPopulated } from "@/utilities/isPopulated";

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = "div", resource } = props;

  const isVideo = isPopulated(resource) && resource.mimeType?.includes("video");
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
