import preview from "#.storybook/preview";
import { Route, Router } from "@solidjs/router";
import { Nav } from "../../Nav";

const meta = preview.meta({
  title: "Tom/Nav",
  component: Nav,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Router>
        <Route path="/" component={() => <Story />} />
      </Router>
    ),
  ],
});

export default meta;

export const Default = meta.story({});
