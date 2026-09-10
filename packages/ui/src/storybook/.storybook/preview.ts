import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "storybook-solidjs-vite";
import { useColorMode } from "@tom/ui/color-mode";
import "./tomui.css";

export default definePreview({
  addons: [addonDocs(), addonA11y()],
  decorators: [
    (Story) => {
      useColorMode();
      document.body.style.backgroundColor = "var(--color-tomui-canvas)";
      document.body.style.color = "var(--text-color-tomui-default)";
      return Story();
    },
  ],
  parameters: {
    // automatically create action args for all props that start with 'on'
    actions: {
      argTypesRegex: "^on.*",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  // All components will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  // tags: ['autodocs'],
});
