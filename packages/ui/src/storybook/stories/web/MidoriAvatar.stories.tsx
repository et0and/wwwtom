import preview from "#.storybook/preview";
import { Avatar } from "@tom/ui/avatar";

const meta = preview.meta({
  title: "web/Avatar",
  component: Avatar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const image =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%233b5cf6'/%3E%3Ccircle cx='32' cy='24' r='11' fill='%23fff'/%3E%3Cpath d='M12 60c2-12 10-18 20-18s18 6 20 18' fill='%23fff'/%3E%3C/svg%3E";

export const Default = meta.story({
  args: { fallback: "Alice" },
});

export const Sizes = meta.story({
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", "align-items": "center" }}>
      <Avatar fallback="Alice" size="small" />
      <Avatar fallback="Alice" size="normal" />
      <Avatar fallback="Alice" size="large" />
    </div>
  ),
});

export const Organization = meta.story({
  args: { fallback: "Acme", kind: "org" },
});

export const Image = meta.story({
  args: { fallback: "Alice", src: image, alt: "Alice" },
});

export const FixedColours = meta.story({
  args: { fallback: "A", background: "#3b5cf6", foreground: "#ffffff" },
});
