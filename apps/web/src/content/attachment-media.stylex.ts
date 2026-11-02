import * as stylex from "@stylexjs/stylex";
import { colors } from "@tom/ui/colors.stylex";

/**
 * Styles for the attachment players. The post body and the are.na channel
 * strip both draw them, so the way a video or an audio file previews is
 * defined in one place.
 */
export const attachmentMediaStyles = stylex.create({
  playOverlay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    display: "flex",
    height: "3.5rem",
    width: "3.5rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: `color-mix(in srgb, ${colors["--color-black"]} 60%, transparent)`,
    color: colors["--color-white"],
  },
  playIcon: {
    height: "1.5rem",
    width: "1.5rem",
    fill: "currentColor",
  },
  videoTrigger: {
    display: "block",
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
    padding: 0,
  },
  videoCoverFallback: {
    position: "relative",
    display: "flex",
    height: "11rem",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors["--color-tomui-tint"],
  },
  figure: { margin: 0 },
});
