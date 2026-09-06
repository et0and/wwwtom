import preview from "#.storybook/preview";
import { createRouter, memoryHistory } from "@solidjs/router";
import { Nav } from "../../Nav";

const meta = preview.meta({
  title: "web/Nav",
  component: Nav,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const TestRouter = createRouter({
        history: memoryHistory("/"),
        routes: [{ path: "/", component: () => <Story /> }],
      });
      return <TestRouter />;
    },
  ],
});

export default meta;

export const Default = meta.story({});
