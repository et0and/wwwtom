import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "storybook-solidjs-vite";
import { themes } from "storybook/theming";
import { useColorMode } from "@tom/ui/color-mode";
import "./tomui.css";

const prefersDark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches === true;

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
    // Keep the docs container in step with the OS, so the index doc does not
    // render light while the components and Storybook chrome are dark.
    docs: {
      theme: prefersDark ? themes.dark : themes.light,
    },
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
