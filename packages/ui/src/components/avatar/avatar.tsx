import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSize2xs, fontWeightControl } from "../../styles/typography.stylex";

export const MIDORI_AVATAR_DEFAULT_VARIANTS = {
  size: "large",
  kind: "user",
} as const;

export type MidoriAvatarSize = "small" | "normal" | "large";
export type MidoriAvatarKind = "user" | "org";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstGrapheme(value: string): string {
  if (!value) return "";
  return (
    segmenter.segment(value)[Symbol.iterator]().next().value?.segment ?? Array.from(value)[0] ?? ""
  );
}

type AvatarStyle = { "--avatar-bg"?: string; "--avatar-fg"?: string };

const styles = stylex.create({
  base: {
    position: "relative",
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    width: "1.75rem",
    height: "1.75rem",
    borderWidth: "0.5px",
    borderStyle: "solid",
    borderColor: colors["--color-midori-hairline"],
    borderRadius: radius.full,
    backgroundColor: "var(--avatar-bg, " + colors["--color-midori-layer-02"] + ")",
    color: "var(--avatar-fg, " + textColors["--text-color-midori-subtle"] + ")",
    fontSize: fontSize2xs.fontSize,
    fontWeight: fontWeightControl.fontWeight,
    lineHeight: 1,
    textTransform: "uppercase",
    userSelect: "none",
  },
  sizeNormal: { width: "1.25rem", height: "1.25rem" },
  sizeSmall: { width: "1rem", height: "1rem" },
  org: { borderRadius: radius.md },
  orgSmall: { borderRadius: radius.sm },
  sheen: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(180deg, " +
      colors["--color-midori-sheen-top"] +
      " 0%, " +
      colors["--color-midori-sheen-bottom"] +
      " 100%)",
    pointerEvents: "none",
  },
  image: {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    userSelect: "none",
  },
});

const sizeStyles = {
  small: styles.sizeSmall,
  normal: styles.sizeNormal,
  large: undefined,
} as const;

export type AvatarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style" | "children"> & {
  /** Name or label. Its first grapheme is the fallback. */
  fallback: string;
  /** Image URL. When present it replaces the fallback. */
  src?: string | undefined;
  /** Accessible label for the image. Empty by default, for decorative avatars. */
  alt?: string | undefined;
  /** Fixed background for the fallback. */
  background?: string | undefined;
  /** Fixed foreground for the fallback. */
  foreground?: string | undefined;
  size?: MidoriAvatarSize;
  kind?: MidoriAvatarKind;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Avatar(props: AvatarProps): JSX.Element {
  const merged = merge(MIDORI_AVATAR_DEFAULT_VARIANTS, props);
  const rest = omit(
    merged,
    "fallback",
    "src",
    "alt",
    "background",
    "foreground",
    "size",
    "kind",
    "style",
  );
  const isOrg = (): boolean => merged.kind === "org";
  const avatarStyle = (): AvatarStyle | undefined => {
    if (merged.src) return undefined;
    const style: AvatarStyle = {};
    if (merged.background) style["--avatar-bg"] = merged.background;
    if (merged.foreground) style["--avatar-fg"] = merged.foreground;
    return style;
  };
  return (
    <div
      {...rest}
      data-midori-component="Avatar"
      data-size={merged.size}
      data-kind={merged.kind}
      data-has-image={merged.src ? "" : undefined}
      {...stylex.attrs(
        styles.base,
        sizeStyles[merged.size],
        isOrg() ? styles.org : undefined,
        isOrg() && merged.size !== "large" ? styles.orgSmall : undefined,
        merged.style,
      )}
      style={avatarStyle()}
    >
      <Show
        when={merged.src}
        fallback={
          <>
            <span aria-hidden="true" {...stylex.attrs(styles.sheen)} />
            {firstGrapheme(merged.fallback)}
          </>
        }
      >
        {(src) => (
          <img
            src={src()}
            alt={merged.alt ?? ""}
            draggable={false}
            {...stylex.attrs(styles.image)}
          />
        )}
      </Show>
    </div>
  );
}
