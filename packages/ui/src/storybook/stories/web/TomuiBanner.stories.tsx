import preview from "#.storybook/preview";
import { Banner } from "@tom/ui/tomui/banner";

const meta = preview.meta({
  title: "web/Banner",
  component: Banner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  args: {
    title: "Update available",
    description: "A new version is ready to install.",
  },
});

export const Alert = meta.story({
  args: {
    variant: "alert",
    title: "Session expiring",
    description: "Your session will expire in 5 minutes.",
  },
});

export const Error = meta.story({
  args: {
    variant: "error",
    title: "Save failed",
    description: "We could not save your changes.",
  },
});

export const Secondary = meta.story({
  args: {
    variant: "secondary",
    title: "Draft saved",
    description: "Your draft was saved as a backup.",
  },
});

export const Small = meta.story({
  args: {
    size: "sm",
    title: "Review required",
    description: "Please review your billing information.",
  },
});

export const WithAction = meta.story({
  render: () => (
    <Banner
      title="Update available"
      description="A new version is ready to install."
      action={<Banner.Action>Install now</Banner.Action>}
    />
  ),
});

export const AlertWithAction = meta.story({
  render: () => (
    <Banner
      variant="alert"
      title="Storage almost full"
      description="You have used 90% of your storage."
      action={<Banner.Action variant="secondary">Manage storage</Banner.Action>}
    />
  ),
});

export const CompactWithAction = meta.story({
  render: () => (
    <Banner
      size="sm"
      variant="error"
      title="Sync failed"
      description="Retrying in the background."
      action={<Banner.Action variant="ghost">Retry</Banner.Action>}
    />
  ),
});
