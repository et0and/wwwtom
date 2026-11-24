import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { DocsContainerProps, DocsContextProps } from "@storybook/addon-docs/blocks";
import { createElement, useEffect, useState } from "react";
import { definePreview } from "storybook-solidjs-vite";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { themes } from "storybook/theming";
import type { ThemeVars } from "storybook/theming";
import "./midori.css";

type ColorMode = "light" | "dark";

const colorModeOf = (value: string | undefined): ColorMode => (value === "dark" ? "dark" : "light");

/** Keep the preview document and the Midori tokens on the same color mode. */
const applyColorMode = (mode: ColorMode): void => {
  const root = document.documentElement;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
  document.body.style.backgroundColor = "var(--color-midori-canvas)";
  document.body.style.color = "var(--text-color-midori-default)";
};

/**
 * The docs page is rendered by `@storybook/addon-docs`, which paints its own
 * theme over the preview body. Swap that theme with the color mode so the page
 * follows the toolbar instead of staying light. The theme colors must be
 * concrete values: Storybook derives shades from them with `polished`, which
 * cannot parse CSS custom properties.
 */
const docsTheme = (mode: ColorMode): ThemeVars => themes[mode];

const COLOR_MODE_GLOBAL = "colorMode:";

/** The manager seeds globals into the iframe query as `globals=a:1;b:2`. */
const readUrlColorMode = (): ColorMode | undefined => {
  const raw = new URLSearchParams(window.location.search).get("globals");
  const entry = raw?.split(";").find((pair) => pair.startsWith(COLOR_MODE_GLOBAL));
  if (entry === undefined) return undefined;
  return colorModeOf(entry.slice(COLOR_MODE_GLOBAL.length).replace(/^!/, ""));
};

const readStoryColorMode = (context: DocsContextProps): ColorMode | undefined => {
  const [story] = context.componentStories();
  if (story === undefined) return undefined;
  const value: string | undefined = context.getStoryContext(story).globals.colorMode;
  return colorModeOf(value);
};

const initialColorMode = (context: DocsContextProps): ColorMode =>
  readUrlColorMode() ?? readStoryColorMode(context) ?? "light";

type GlobalsPayload = { globals?: { readonly colorMode?: string } };

/**
 * Storybook remounts the docs container on every global change, so component
 * state cannot carry the mode across renders. Keep the latest value at module
 * scope and seed every new mount from it.
 */
type DocsModeStore = { current: ColorMode | undefined };

const docsMode: DocsModeStore = { current: undefined };

const MidoriDocsContainer = (props: DocsContainerProps) => {
  const [mode, setMode] = useState<ColorMode>(
    () => docsMode.current ?? initialColorMode(props.context),
  );
  docsMode.current = mode;

  useEffect(() => {
    const { channel } = props.context;
    const handleGlobals = (payload: GlobalsPayload): void => {
      const next = colorModeOf(payload.globals?.colorMode);
      docsMode.current = next;
      setMode(next);
    };
    channel.on(SET_GLOBALS, handleGlobals);
    channel.on(GLOBALS_UPDATED, handleGlobals);
    return () => {
      channel.off(SET_GLOBALS, handleGlobals);
      channel.off(GLOBALS_UPDATED, handleGlobals);
    };
  }, [props.context]);

  useEffect(() => {
    applyColorMode(mode);
  }, [mode]);

  return createElement(DocsContainer, { ...props, theme: docsTheme(mode) });
};

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
      const value: string | undefined = context.globals.colorMode;
      applyColorMode(colorModeOf(value));
      return Story();
    },
  ],
  parameters: {
    docs: {
      container: MidoriDocsContainer,
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
