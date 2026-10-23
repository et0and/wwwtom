import preview from "#.storybook/preview";
import { Button } from "@tom/ui/button";
import { fn } from "storybook/test";

const meta = preview.meta({
  title: "web/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { onClick: fn() },
});

export const Primary = meta.story({
  args: {
    variant: "primary",
    children: "Save changes",
  },
});

export const Secondary = meta.story({
  args: {
    variant: "secondary",
    children: "Cancel",
  },
});

export const Ghost = meta.story({
  args: {
    variant: "ghost",
    children: "Skip",
  },
});

export const Destructive = meta.story({
  args: {
    variant: "destructive",
    children: "Delete",
  },
});

export const SecondaryDestructive = meta.story({
  args: {
    variant: "secondary-destructive",
    children: "Remove",
  },
});

export const Outline = meta.story({
  args: {
    variant: "outline",
    children: "Learn more",
  },
});

export const Glass = meta.story({
  args: {
    variant: "glass",
    children: "Glass",
  },
});

/**
 * The variant is translucent and blurred, so what sits behind it is part of how
 * it reads. Stripes make that legible: the banding stops at the edge and
 * smears behind the fill, which is the effect a flat canvas cannot show.
 */
export const GlassOverContent = meta.story({
  args: {
    variant: "glass",
    size: "lg",
    children: "Glass",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          display: "grid",
          "place-items": "center",
          padding: "5rem 6rem",
          "border-radius": "1rem",
          background:
            "repeating-linear-gradient(135deg, #6d5efc 0 18px, #18d4c4 18px 36px, #ff7ac2 36px 54px)",
        }}
      >
        <Story />
      </div>
    ),
  ],
});

export const Small = meta.story({
  args: {
    size: "sm",
    children: "Small",
  },
});

export const Large = meta.story({
  args: {
    size: "lg",
    children: "Large",
  },
});

export const Loading = meta.story({
  args: {
    variant: "primary",
    loading: true,
    children: "Saving",
  },
});

export const Disabled = meta.story({
  args: {
    disabled: true,
    children: "Disabled",
  },
});

export const Square = meta.story({
  args: {
    form: "square",
    "aria-label": "Refresh",
    children: "↻",
  },
});

export const Circle = meta.story({
  args: {
    form: "circle",
    "aria-label": "Close",
    children: "×",
  },
});

export const WithIcon = meta.story({
  args: {
    variant: "secondary",
    children: "Download",
    icon: <span aria-hidden="true">↓</span>,
  },
});
