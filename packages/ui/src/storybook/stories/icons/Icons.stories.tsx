import preview from "#.storybook/preview";
import { For, type Component } from "solid-js";
import { ArrowRightIcon } from "@tom/icons/ArrowRight";
import { BellIcon } from "@tom/icons/Bell";
import { CheckIcon } from "@tom/icons/Check";
import { HeartIcon } from "@tom/icons/Heart";
import { HouseIcon } from "@tom/icons/House";
import { MagnifyingGlassIcon } from "@tom/icons/MagnifyingGlass";
import { PlusIcon } from "@tom/icons/Plus";
import { DiscordIcon } from "@tom/icons/social/discord";
import { GithubIcon } from "@tom/icons/social/github";
import { GoogleIcon } from "@tom/icons/social/google";
import { MastodonIcon } from "@tom/icons/social/mastodon";
import { StarIcon } from "@tom/icons/Star";
import {
  ICON_COLORS,
  ICON_SIZES,
  ICON_WEIGHTS,
  type IconProps,
  type IconSize,
} from "@tom/icons/types";
import { XIcon } from "@tom/icons/X";

const meta = preview.meta({
  title: "icons/Icon",
  component: MagnifyingGlassIcon,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: Object.keys(ICON_SIZES),
    },
    color: {
      control: "select",
      options: Object.keys(ICON_COLORS),
    },
    weight: {
      control: "select",
      options: [...ICON_WEIGHTS],
    },
    mirrored: {
      control: "boolean",
    },
  },
});

export default meta;

export const Playground = meta.story({
  args: {
    size: "xl",
    color: "current",
    weight: "regular",
    mirrored: false,
  },
});

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
} as const;

const cellStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
} as const;

const labelStyle = {
  fontSize: "12px",
  opacity: "0.7",
} as const;

type GalleryEntry = {
  readonly name: string;
  readonly Icon: Component<IconProps>;
};

const galleryIcons: Array<GalleryEntry> = [
  { name: "MagnifyingGlass", Icon: MagnifyingGlassIcon },
  { name: "Bell", Icon: BellIcon },
  { name: "Heart", Icon: HeartIcon },
  { name: "House", Icon: HouseIcon },
  { name: "Star", Icon: StarIcon },
  { name: "Check", Icon: CheckIcon },
  { name: "Plus", Icon: PlusIcon },
  { name: "X", Icon: XIcon },
  { name: "ArrowRight", Icon: ArrowRightIcon },
];

const socialIcons: Array<GalleryEntry> = [
  { name: "Google", Icon: GoogleIcon },
  { name: "Github", Icon: GithubIcon },
  { name: "Discord", Icon: DiscordIcon },
  { name: "Mastodon", Icon: MastodonIcon },
];

export const Gallery = meta.story({
  render: () => (
    <div style={rowStyle}>
      <For each={galleryIcons}>
        {(entry) => (
          <div style={cellStyle}>
            <entry.Icon size="xl" title={entry.name} />
            <span style={labelStyle}>{entry.name}</span>
          </div>
        )}
      </For>
    </div>
  ),
});

export const Weights = meta.story({
  render: () => (
    <div style={rowStyle}>
      <For each={[...ICON_WEIGHTS]}>
        {(weight) => (
          <div style={cellStyle}>
            <HeartIcon size="xl" weight={weight} title={weight} />
            <span style={labelStyle}>{weight}</span>
          </div>
        )}
      </For>
    </div>
  ),
});

const iconSizes: Array<IconSize> = ["xs", "sm", "md", "lg", "xl", "2xl"];

export const Sizes = meta.story({
  render: () => (
    <div style={rowStyle}>
      <For each={iconSizes}>
        {(size) => (
          <div style={cellStyle}>
            <BellIcon size={size} title={size} />
            <span style={labelStyle}>{size}</span>
          </div>
        )}
      </For>
    </div>
  ),
});

export const Social = meta.story({
  render: () => (
    <div style={rowStyle}>
      <For each={socialIcons}>
        {(entry) => (
          <div style={cellStyle}>
            <entry.Icon size="xl" title={entry.name} />
            <span style={labelStyle}>{entry.name}</span>
          </div>
        )}
      </For>
    </div>
  ),
});
