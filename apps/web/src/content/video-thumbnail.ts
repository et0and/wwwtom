/**
 * are.na stores no thumbnail for an uploaded video: an mp4 attachment comes
 * back with `image: null`, so the player has nothing to show until it plays.
 *
 * The browser can make one itself. It reads the file header
 * (`preload="metadata"`), seeks a fraction of the way in, and paints that frame
 * on a canvas. are.na's attachment CDN allows anonymous CORS, so the canvas is
 * not tainted and the frame can be used as an image. The reads are ranged, so
 * this costs a slice of the file rather than the whole download.
 *
 * Results are cached per URL because the same attachment can appear in a post
 * body and in a channel strip on the same page.
 */

/** Wide enough for the post body at 2x, small enough to stay cheap to hold. */
const CAPTURE_WIDTH = 640;

/** A stalled request must not leave a player previewless forever. */
const CAPTURE_TIMEOUT_MS = 10_000;

const thumbnails = new Map<string, Promise<string | null>>();

const captureFrame = (video: HTMLVideoElement): string | null => {
  const scale = video.videoHeight / video.videoWidth;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = Math.round(CAPTURE_WIDTH * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    // A tainted canvas cannot be read; the caller falls back to the plain cover.
    return null;
  }
};

const loadFrame = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const finish = (frame: string | null): void => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(frame);
    };

    const timer = setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS);

    video.addEventListener("error", () => finish(null), { once: true });
    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        // The opening frame is often a fade from black; 10% in is usually real
        // content and still close enough to the start to identify the clip.
        video.currentTime = Math.max(Math.min(duration * 0.1, 2), 0.1);
      },
      { once: true },
    );
    video.addEventListener("seeked", () => finish(captureFrame(video)), { once: true });

    video.src = url;
  });

/** First frame of a video as an image, or null when the browser cannot read one. */
export const videoThumbnail = (url: string): Promise<string | null> => {
  const cached = thumbnails.get(url);
  if (cached) return cached;
  const pending = loadFrame(url).then((frame) => {
    if (frame === null) thumbnails.delete(url);
    return frame;
  });
  thumbnails.set(url, pending);
  return pending;
};
