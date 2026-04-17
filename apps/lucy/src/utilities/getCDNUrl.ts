/**
 * Converts S3/R2 URLs to CDN URLs if CDN_URL is configured
 */
export const getCDNUrl = (url: string): string => {
  if (!url) return url;

  const cdnUrl = process.env.CDN_URL;
  if (!cdnUrl) return url;

  // If URL is already using CDN, return as-is
  if (url.startsWith(cdnUrl)) return url;

  // Extract filename from S3 URL and convert to CDN URL
  const filename = url.split("/").pop();
  return `${cdnUrl}/${filename}`;
};
