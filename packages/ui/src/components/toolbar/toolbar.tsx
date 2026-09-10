import type { JSX } from "@solidjs/web";
import { createContext, merge, omit, useContext } from "solid-js";
import { cn } from "../../utils/cn";

/** @deprecated Toolbar size customization is deprecated. Omit `size` to use the default base size. */
export const TOMUI_TOOLBAR_VARIANTS = {
  size: {
    xs: {
      classes: "text-xs",
      description: "Extra small toolbar for compact UIs",
    },
    sm: {
      classes: "text-xs",
      description: "Small toolbar for secondary controls",
    },
    base: {
      classes: "text-base",
      description: "Default toolbar size",
    },
    lg: {
      classes: "text-base",
      description: "Large toolbar for prominent controls",
    },
  },
} as const;

/** @deprecated Toolbar size customization is deprecated. Omit `size` to use the default base size. */
export const TOMUI_TOOLBAR_DEFAULT_VARIANTS = {
  size: "base",
} as const;

/** @deprecated Toolbar size customization is deprecated. Omit `size` to use the default base size. */
export type ToolbarSize = keyof typeof TOMUI_TOOLBAR_VARIANTS.size;

export type ToolbarProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
  size?: ToolbarSize;
};

export type ToolbarButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  loading?: boolean;
};

export type ToolbarLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
};

export type ToolbarInputProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  class?: string;
};

const ToolbarSizeContext = createContext<{ size: ToolbarSize }>({ size: "base" });

const TOOLBAR_CONTROL_STYLES = cn(
  "relative min-w-0 rounded-none border-0 bg-transparent shadow-none ring-0",
  "focus-within:z-2 focus:z-2 focus-visible:z-2",
);

function Root(props: ToolbarProps): JSX.Element {
  const merged = merge({ size: TOMUI_TOOLBAR_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "children", "class", "size");
  return (
    <ToolbarSizeContext value={{ size: merged.size }}>
      <div
        {...rest}
        data-tomui-component="Toolbar"
        role="toolbar"
        class={cn(
          "inline-flex w-fit items-stretch rounded-lg bg-tomui-control shadow-xs ring ring-tomui-line",
          "[&>*:not([aria-hidden='true']):not(:first-child)]:border-l [&>*:not([aria-hidden='true']):not(:first-child)]:border-tomui-line",
          TOMUI_TOOLBAR_VARIANTS.size[merged.size].classes,
          merged.class,
        )}
      >
        {merged.children}
      </div>
    </ToolbarSizeContext>
  );
}

function ToolbarButton(props: ToolbarButtonProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "disabled", "loading", "icon");
  return (
    <button
      data-tomui-component="Toolbar.Button"
      type="button"
      disabled={merged.loading || merged.disabled}
      aria-busy={merged.loading === true ? "true" : "false"}
      class={cn(
        TOOLBAR_CONTROL_STYLES,
        "inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-inherit",
        merged.class,
      )}
      {...rest}
    >
      {merged.icon}
      {merged.children}
    </button>
  );
}

function ToolbarLink(props: ToolbarLinkProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "icon");
  return (
    <a
      data-tomui-component="Toolbar.Link"
      class={cn(
        TOOLBAR_CONTROL_STYLES,
        "inline-flex items-center gap-1 px-2 py-1 text-inherit no-underline",
        merged.class,
      )}
      {...rest}
    >
      {merged.icon}
      {merged.children}
    </a>
  );
}

function ToolbarInput(props: ToolbarInputProps): JSX.Element {
  const toolbar = useContext(ToolbarSizeContext);
  const merged = merge({}, props);
  const rest = omit(merged, "class");
  void toolbar;
  return (
    <input
      data-tomui-component="Toolbar.Input"
      data-tomui-toolbar-input=""
      class={cn(TOOLBAR_CONTROL_STYLES, "px-2 py-1 text-inherit", merged.class)}
      {...rest}
    />
  );
}

export type ToolbarInputGroupProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

function ToolbarInputGroup(props: ToolbarInputGroupProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <div
      data-tomui-component="Toolbar.InputGroup"
      class={cn(TOOLBAR_CONTROL_STYLES, "inline-flex items-center", merged.class)}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export const Toolbar = Object.assign(Root, {
  Button: ToolbarButton,
  Link: ToolbarLink,
  Input: ToolbarInput,
  InputGroup: ToolbarInputGroup,
});
