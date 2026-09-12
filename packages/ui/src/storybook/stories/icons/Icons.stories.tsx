import preview from "#.storybook/preview";
import type { JSX } from "@solidjs/web";
import { For, omit, Show, type Component } from "solid-js";
import { BellIcon } from "@tom/icons/Bell";
import { HeartIcon } from "@tom/icons/Heart";
import { DiscordIcon } from "@tom/icons/social/discord";
import { GithubIcon } from "@tom/icons/social/github";
import { GoogleIcon } from "@tom/icons/social/google";
import { MastodonIcon } from "@tom/icons/social/mastodon";
import {
  ICON_COLORS,
  ICON_SIZES,
  ICON_WEIGHTS,
  type IconProps,
  type IconSize,
} from "@tom/icons/types";
import { iconComponent, iconNames } from "./iconRegistry.ts";

type PlaygroundProps = IconProps & {
  readonly icon: string;
};

/** Playground wrapper: resolves the selected registry icon by name. */
const PlaygroundIcon = (props: PlaygroundProps): JSX.Element => {
  const rest = omit(props, "icon");
  const Found = (): Component<IconProps> | undefined => iconComponent(props.icon);
  return (
    <Show when={Found()} fallback={<span>Unknown icon: {props.icon}</span>}>
      {(icon) => {
        const Icon = icon();
        return <Icon {...rest} />;
      }}
    </Show>
  );
};

const meta = preview.meta({
  title: "icons/Icon",
  component: PlaygroundIcon,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    icon: {
      control: "select",
      options: iconNames,
    },
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
    icon: "MagnifyingGlass",
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

const gridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  maxWidth: "960px",
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

const socialIcons: Array<GalleryEntry> = [
  { name: "Google", Icon: GoogleIcon },
  { name: "Github", Icon: GithubIcon },
  { name: "Discord", Icon: DiscordIcon },
  { name: "Mastodon", Icon: MastodonIcon },
];

export const AllIcons = meta.story({
  render: () => (
    <div style={gridStyle}>
      <For each={iconNames}>
        {(name) => {
          const Found = iconComponent(name);
          if (Found === undefined) return null;
          return (
            <div style={cellStyle}>
              <Found size="md" title={name} />
              <span style={labelStyle}>{name}</span>
            </div>
          );
        }}
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
