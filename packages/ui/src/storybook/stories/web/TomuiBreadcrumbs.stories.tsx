import preview from "#.storybook/preview";
import {
  BreadcrumbCurrent,
  BreadcrumbLink,
  Breadcrumbs,
  BreadcrumbSeparator,
} from "@tom/ui/breadcrumbs";

const meta = preview.meta({
  title: "web/Breadcrumbs",
  component: Breadcrumbs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    items: [
      { label: "Home", href: "/" },
      { label: "Docs", href: "/docs" },
      { label: "Getting started" },
    ],
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    items: [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "Release notes" },
    ],
  },
});

export const TwoLevels = meta.story({
  args: {
    items: [{ label: "Settings", href: "/settings" }, { label: "Billing" }],
  },
});

export const CustomChildren = meta.story({
  render: () => (
    <Breadcrumbs>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
      <BreadcrumbSeparator />
      <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
      <BreadcrumbSeparator />
      <BreadcrumbCurrent>Installation</BreadcrumbCurrent>
    </Breadcrumbs>
  ),
});
