import preview from "#.storybook/preview";
import { Link } from "@tom/ui/tomui/link";

const meta = preview.meta({
  title: "web/Link",
  component: Link,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Inline = meta.story({
  args: {
    href: "/docs",
    children: "Learn more",
  },
});

export const Current = meta.story({
  args: {
    variant: "current",
    href: "/settings",
    children: "Open settings",
  },
});

export const Plain = meta.story({
  args: {
    variant: "plain",
    href: "/pricing",
    children: "View pricing",
  },
});

export const External = meta.story({
  render: () => (
    <Link href="https://example.com" target="_blank" rel="noopener noreferrer">
      Visit example <Link.ExternalIcon />
    </Link>
  ),
});

export const InlineInText = meta.story({
  render: () => (
    <p class="text-base">
      Read the <Link href="/docs">getting started guide</Link> before deploying.
    </p>
  ),
});
