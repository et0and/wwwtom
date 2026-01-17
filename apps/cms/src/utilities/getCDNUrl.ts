/**
 * Converts S3 URLs to optimised CDN URLs via image optimization endpoint
 */
export const getCDNUrl = (url: string, width?: number): string => {
  if (!url) return url;

  const cdnUrl = process.env.CDN_URL;
  if (!cdnUrl) return url;

  if (url.startsWith(cdnUrl)) return url;

  const filename = url.split("/").pop();
  if (!filename) return url;

  const originalUrl = encodeURIComponent(url);

  if (width) {
    return `https://tom.so/api/image?url=${originalUrl}&width=${width}`;
  }

  return `https://tom.so/api/image?url=${originalUrl}`;
};

interface ImageSize {
  width: number;
  height?: number;
  crop?: "center" | "top" | "bottom" | "left" | "right";
}

const imageSizes: Record<string, ImageSize> = {
  thumbnail: { width: 300 },
  square: { width: 500, height: 500 },
  small: { width: 600 },
  medium: { width: 900 },
  large: { width: 1400 },
  xlarge: { width: 1920 },
  og: { width: 1200, height: 630, crop: "center" },
} as const;

export const getOptimizedMediaUrl = (
  url: string | null | undefined,
  size?: keyof typeof imageSizes,
): string => {
  if (!url) return "";

  const width = size ? imageSizes[size]?.width : undefined;
  return getCDNUrl(url, width);
};
