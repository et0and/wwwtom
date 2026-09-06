import preview from "#.storybook/preview";
import { Sidebar, SidebarItem, SidebarSection } from "@tom/ui/tomui/sidebar";

const meta = preview.meta({
  title: "web/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  render: () => (
    <Sidebar>
      <SidebarSection label="Getting started">
        <SidebarItem href="#" active>
          Overview
        </SidebarItem>
        <SidebarItem href="#">Installation</SidebarItem>
      </SidebarSection>
      <SidebarSection label="Guides">
        <SidebarItem href="#">Routing</SidebarItem>
        <SidebarItem href="#">Styling</SidebarItem>
      </SidebarSection>
    </Sidebar>
  ),
});

export const Floating = meta.story({
  render: () => (
    <Sidebar variant="floating">
      <SidebarSection label="Project">
        <SidebarItem href="#" active>
          Dashboard
        </SidebarItem>
        <SidebarItem href="#">Settings</SidebarItem>
      </SidebarSection>
    </Sidebar>
  ),
});

export const Inset = meta.story({
  render: () => (
    <Sidebar variant="inset">
      <SidebarSection label="Docs">
        <SidebarItem href="#">Introduction</SidebarItem>
        <SidebarItem href="#" active>
          Usage
        </SidebarItem>
      </SidebarSection>
    </Sidebar>
  ),
});

export const RightSide = meta.story({
  render: () => (
    <Sidebar side="right">
      <SidebarSection label="Navigation">
        <SidebarItem href="#" active>
          Home
        </SidebarItem>
        <SidebarItem href="#">Archive</SidebarItem>
      </SidebarSection>
    </Sidebar>
  ),
});

export const NotCollapsible = meta.story({
  render: () => (
    <Sidebar collapsible="none">
      <SidebarSection label="Fixed">
        <SidebarItem href="#" active>
          Pinned
        </SidebarItem>
        <SidebarItem href="#">Other</SidebarItem>
      </SidebarSection>
    </Sidebar>
  ),
});
