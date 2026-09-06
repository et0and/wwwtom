import preview from "#.storybook/preview";
import { MenuBar } from "@tom/ui/tomui/menubar";

const meta = preview.meta({
  title: "web/Menubar",
  component: MenuBar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const noop = (): void => undefined;

export const Default = meta.story({
  render: () => (
    <MenuBar
      isActive={0}
      options={[
        { icon: <span aria-hidden="true">A</span>, tooltip: "Align", onClick: noop },
        { icon: <span aria-hidden="true">B</span>, tooltip: "Bold", onClick: noop },
        { icon: <span aria-hidden="true">C</span>, tooltip: "Comment", onClick: noop },
      ]}
    />
  ),
});

export const SecondSelected = meta.story({
  render: () => (
    <MenuBar
      isActive={1}
      options={[
        { icon: <span aria-hidden="true">A</span>, tooltip: "Align", onClick: noop },
        { icon: <span aria-hidden="true">B</span>, tooltip: "Bold", onClick: noop },
        { icon: <span aria-hidden="true">C</span>, tooltip: "Comment", onClick: noop },
      ]}
    />
  ),
});

export const WithOptionIds = meta.story({
  render: () => (
    <MenuBar
      isActive="bold"
      optionIds
      options={[
        { id: "align", icon: <span aria-hidden="true">A</span>, tooltip: "Align", onClick: noop },
        { id: "bold", icon: <span aria-hidden="true">B</span>, tooltip: "Bold", onClick: noop },
        {
          id: "comment",
          icon: <span aria-hidden="true">C</span>,
          tooltip: "Comment",
          onClick: noop,
        },
      ]}
    />
  ),
});
