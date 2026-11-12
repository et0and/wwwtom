import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { definePreview } from "storybook-solidjs-vite";
import { themes } from "storybook/theming";
import "./midori.css";

type ColorMode = "light" | "dark";

const colorModeOf = (globals: { colorMode?: unknown }): ColorMode =>
  globals.colorMode === "dark" ? "dark" : "light";

export default definePreview({
  addons: [addonDocs(), addonA11y()],
  globalTypes: {
    colorMode: {
      description: "Preview color mode",
      toolbar: {
        title: "Color mode",
        icon: "contrast",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { colorMode: "light" },
  decorators: [
    (Story, context) => {
      const mode = colorModeOf(context.globals);
      document.documentElement.dataset.mode = mode;
      document.documentElement.style.colorScheme = mode;
      document.body.style.backgroundColor = "var(--color-midori-canvas)";
      document.body.style.color = "var(--text-color-midori-default)";
      return Story();
    },
  ],
  parameters: {
    docs: {
      theme: themes.light,
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
