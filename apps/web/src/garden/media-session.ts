import type { Generator } from "./types";

/** Lock-screen and media-key controls, wired to the player's play and pause. */
export interface MediaSessionControls {
  onPlay: () => void;
  onPause: () => void;
}

/**
 * Show the current piece on the lock screen. Clearing it (undefined) marks the
 * session paused, which also releases the OS "now playing" entry.
 */
export const setNowPlaying = (generator: Generator | undefined): void => {
  if (!("mediaSession" in navigator)) return;
  if (generator === undefined) {
    navigator.mediaSession.playbackState = "paused";
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: generator.title,
    artist: "Tom Hackshaw",
    album: "Garden",
    artwork: generator.cover
      ? [{ src: generator.cover, sizes: "512x512", type: "image/jpeg" }]
      : [],
  });
  navigator.mediaSession.playbackState = "playing";
};

export const setMediaSessionControls = (controls: MediaSessionControls): void => {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", () => controls.onPlay());
  navigator.mediaSession.setActionHandler("pause", () => controls.onPause());
};
