import preview from "#.storybook/preview";
import { ArchiveIcon } from "@tom/icons/Archive";
import { BookOpenIcon } from "@tom/icons/BookOpen";
import { CompassIcon } from "@tom/icons/Compass";
import { DownloadIcon } from "@tom/icons/Download";
import { GearIcon } from "@tom/icons/Gear";
import { HouseIcon } from "@tom/icons/House";
import { PaintBrushIcon } from "@tom/icons/PaintBrush";
import { Sidebar, SidebarItem, SidebarSection } from "@tom/ui/sidebar";

const meta = preview.meta({
  title: "web/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
});

const frameStyle = {
  display: "flex",
  height: "32rem",
  width: "48rem",
  maxWidth: "100%",
  overflow: "hidden",
  border: "1px solid var(--color-midori-line)",
  borderRadius: "0.5rem",
  backgroundColor: "var(--color-midori-canvas)",
};

const contentStyle = {
  flex: 1,
  padding: "1.5rem",
  color: "var(--text-color-midori-subtle)",
};

export const Default = meta.story({
  render: () => (
    <div style={frameStyle}>
      <Sidebar>
        <SidebarSection label="Getting started">
          <SidebarItem href="#" active icon={<HouseIcon size="sm" />}>
            Overview
          </SidebarItem>
          <SidebarItem href="#" icon={<DownloadIcon size="sm" />}>
            Installation
          </SidebarItem>
        </SidebarSection>
        <SidebarSection label="Guides">
          <SidebarItem href="#" icon={<CompassIcon size="sm" />}>
            Routing
          </SidebarItem>
          <SidebarItem href="#" icon={<PaintBrushIcon size="sm" />}>
            Styling
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
      <div style={contentStyle}>Content area</div>
    </div>
  ),
});

export const Floating = meta.story({
  render: () => (
    <div style={frameStyle}>
      <Sidebar variant="floating">
        <SidebarSection label="Project">
          <SidebarItem href="#" active icon={<HouseIcon size="sm" />}>
            Dashboard
          </SidebarItem>
          <SidebarItem href="#" icon={<GearIcon size="sm" />}>
            Settings
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
      <div style={contentStyle}>Content area</div>
    </div>
  ),
});

export const Inset = meta.story({
  render: () => (
    <div style={frameStyle}>
      <Sidebar variant="inset">
        <SidebarSection label="Docs">
          <SidebarItem href="#" icon={<BookOpenIcon size="sm" />}>
            Introduction
          </SidebarItem>
          <SidebarItem href="#" active icon={<CompassIcon size="sm" />}>
            Usage
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
      <div style={contentStyle}>Content area</div>
    </div>
  ),
});

export const RightSide = meta.story({
  render: () => (
    <div style={frameStyle}>
      <div style={contentStyle}>Content area</div>
      <Sidebar side="right">
        <SidebarSection label="Navigation">
          <SidebarItem href="#" active icon={<HouseIcon size="sm" />}>
            Home
          </SidebarItem>
          <SidebarItem href="#" icon={<ArchiveIcon size="sm" />}>
            Archive
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
    </div>
  ),
});

export const NotCollapsible = meta.story({
  render: () => (
    <div style={frameStyle}>
      <Sidebar collapsible="none">
        <SidebarSection label="Fixed">
          <SidebarItem href="#" active icon={<HouseIcon size="sm" />}>
            Pinned
          </SidebarItem>
          <SidebarItem href="#" icon={<ArchiveIcon size="sm" />}>
            Other
          </SidebarItem>
        </SidebarSection>
      </Sidebar>
      <div style={contentStyle}>Content area</div>
    </div>
  ),
});
