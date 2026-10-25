import { Show, createSignal, onSettled } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import type { ArenaAttachment, ArenaImage } from "@tom/schemas/arena-content";
import { layout, textAlign } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import {
  arenaImageDimensions,
  arenaImageSource,
  arenaImageSourceSet,
  hasArenaImageSource,
} from "~/content/arena-image";
import { attachmentMediaStyles as styles } from "~/content/attachment-media.stylex";
import { videoThumbnail } from "~/content/video-thumbnail";

export type AttachmentKind = "pdf" | "video" | "audio" | "file";

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i;

/**
 * What an attachment is, decided from the strongest signal available.
 * `content_type` is authoritative when are.na sends one, but it is optional and
 * is not always helpful (uploads can arrive as `application/octet-stream`), so
 * the stored filename decides next.
 *
 * The human title is consulted last and only as a fallback: it is free text, so
 * a video titled "Holiday clip" must still preview rather than quietly become a
 * download link.
 *
 * Both surfaces that show an attachment — the post body and the are.na channel
 * strip — ask this one function, so they cannot disagree about what a file is.
 */
export const attachmentKind = (
  attachment: ArenaAttachment,
  title?: string | null,
): AttachmentKind => {
  const contentType = (attachment.content_type ?? "").toLowerCase();
  if (contentType === "application/pdf") return "pdf";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";

  const kindFromName = (name: string | null | undefined): AttachmentKind | undefined => {
    if (!name) return undefined;
    if (/\.pdf$/i.test(name)) return "pdf";
    if (VIDEO_EXTENSIONS.test(name)) return "video";
    if (AUDIO_EXTENSIONS.test(name)) return "audio";
    return undefined;
  };

  return kindFromName(attachment.filename) ?? kindFromName(title) ?? "file";
};

/** What to call an attachment on screen: its title, else its stored filename. */
export const attachmentName = (attachment: ArenaAttachment, title?: string | null): string =>
  title || attachment.filename || "Attachment";

/** are.na's cover, when it sends a usable one. */
const arenaCover = (image: ArenaImage | null): ArenaImage | null =>
  image && hasArenaImageSource(image) ? image : null;

export function PlayOverlay() {
  return (
    <span {...stylex.attrs(layout.absoluteInset0, styles.playOverlay)}>
      <span {...stylex.attrs(styles.playButton)}>
        <svg viewBox="0 0 24 24" {...stylex.attrs(styles.playIcon)} aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * are.na sends no cover for an uploaded video, so the preview asks the browser
 * for its first frame. That read is lazy — only a preview on screen starts it —
 * and when it fails the plain play cover stays. Playback still waits for a
 * click, so an unopened video costs only the thumbnail read.
 */
export function VideoAttachment(props: { url: string; name: string; cover: ArenaImage | null }) {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [frame, setFrame] = createSignal<string | null>(null);
  const cover = () => arenaCover(props.cover);
  const source = () => (cover() ? arenaImageSource(cover()) : frame());
  let preview: HTMLSpanElement | undefined;

  onSettled(() => {
    if (cover() || !preview) return;
    const capture = (): void => {
      void videoThumbnail(props.url).then((captured) => {
        if (captured) setFrame(captured);
      });
    };
    if (!("IntersectionObserver" in window)) {
      capture();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        capture();
      },
      { rootMargin: "300px" },
    );
    observer.observe(preview);
    return () => observer.disconnect();
  });

  return (
    <Show
      when={isPlaying()}
      fallback={
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`Play ${props.name}`}
          {...stylex.attrs(styles.videoTrigger, layout.fullWidth, textAlign.left)}
        >
          <span
            ref={(element) => {
              preview = element;
            }}
            {...stylex.attrs(layout.relative, layout.block)}
          >
            <Show
              when={source()}
              fallback={
                <span {...stylex.attrs(styles.videoCoverFallback)}>
                  <PlayOverlay />
                </span>
              }
            >
              {(src) => (
                <>
                  <img
                    src={src()}
                    {...(cover() ? { srcset: arenaImageSourceSet(cover()) } : {})}
                    alt={props.name}
                    {...stylex.attrs(layout.fullWidth)}
                    loading="lazy"
                    {...(cover() ? arenaImageDimensions(cover()) : {})}
                  />
                  <PlayOverlay />
                </>
              )}
            </Show>
          </span>
          <Text>{props.name}</Text>
        </button>
      }
    >
      <video
        src={props.url}
        controls
        preload="metadata"
        poster={source() ?? undefined}
        {...stylex.attrs(layout.fullWidth)}
      >
        Your browser does not support the video element.
      </video>
    </Show>
  );
}

/**
 * Audio needs no click-to-load: `preload="metadata"` fetches only the header, so
 * the player can sit inline like any other block. are.na's cover, when it has
 * one, stands in as artwork above it.
 */
export function AudioAttachment(props: { url: string; name: string; cover: ArenaImage | null }) {
  const cover = () => arenaCover(props.cover);
  return (
    <figure {...stylex.attrs(styles.figure)}>
      <Show when={cover()}>
        {(artwork) => (
          <img
            src={arenaImageSource(artwork())}
            srcset={arenaImageSourceSet(artwork())}
            alt={props.name}
            {...stylex.attrs(layout.fullWidth)}
            loading="lazy"
            {...arenaImageDimensions(artwork())}
          />
        )}
      </Show>
      <audio src={props.url} controls preload="metadata" {...stylex.attrs(layout.fullWidth)}>
        Your browser does not support the audio element.
      </audio>
      <figcaption>
        <Text>{props.name}</Text>
      </figcaption>
    </figure>
  );
}
