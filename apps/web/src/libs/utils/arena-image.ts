interface ArenaImageVersionLike {
  readonly src: string;
  readonly src_2x?: string | null | undefined;
}

interface ArenaImageLike {
  readonly src?: string | null | undefined;
  readonly alt_text?: string | null | undefined;
  readonly medium?: ArenaImageVersionLike | null | undefined;
  readonly large?: ArenaImageVersionLike | null | undefined;
}

export type ArenaImageInput = ArenaImageLike | null | undefined;

export const arenaImageSource = (image: ArenaImageInput): string =>
  image?.medium?.src ?? image?.large?.src ?? image?.src ?? "";

export const arenaImageSourceSet = (image: ArenaImageInput): string | undefined => {
  const version = image?.medium;
  return version?.src_2x ? `${version.src} 1x, ${version.src_2x} 2x` : undefined;
};

export const arenaImageAlt = (image: ArenaImageInput, title: string | null | undefined): string =>
  image?.alt_text || title || "";

export const hasArenaImageSource = (image: ArenaImageInput): boolean =>
  arenaImageSource(image) !== "";
