import preview from "#.storybook/preview";
import { Toolbar } from "@tom/ui/tomui/toolbar";

const meta = preview.meta({
  title: "web/Toolbar",
  component: Toolbar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const Default = meta.story({
  render: () => (
    <Toolbar>
      <Toolbar.Button>Bold</Toolbar.Button>
      <Toolbar.Button>Italic</Toolbar.Button>
      <Toolbar.Button>Underline</Toolbar.Button>
    </Toolbar>
  ),
});

export const WithIcons = meta.story({
  render: () => (
    <Toolbar>
      <Toolbar.Button icon={<span aria-hidden="true">B</span>}>Bold</Toolbar.Button>
      <Toolbar.Button icon={<span aria-hidden="true">I</span>}>Italic</Toolbar.Button>
      <Toolbar.Button loading>Saving</Toolbar.Button>
    </Toolbar>
  ),
});

export const WithSearch = meta.story({
  render: () => (
    <Toolbar>
      <Toolbar.InputGroup>
        <Toolbar.Input placeholder="Search docs" aria-label="Search docs" />
      </Toolbar.InputGroup>
      <Toolbar.Button>Go</Toolbar.Button>
    </Toolbar>
  ),
});

export const WithLinks = meta.story({
  render: () => (
    <Toolbar>
      <Toolbar.Link href="#overview">Overview</Toolbar.Link>
      <Toolbar.Link href="#guides">Guides</Toolbar.Link>
      <Toolbar.Link href="#api">API</Toolbar.Link>
    </Toolbar>
  ),
});
