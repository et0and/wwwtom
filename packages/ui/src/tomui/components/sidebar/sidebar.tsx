import { createSignal, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_SIDEBAR_VARIANTS = {
  variant: {
    sidebar: { classes: "", description: "Standard sidebar with border separator" },
    floating: { classes: "", description: "Floating sidebar with shadow and rounded corners" },
    inset: { classes: "", description: "Inset sidebar within the content area" },
  },
  collapsible: {
    icon: { classes: "", description: "Collapses to show icons only" },
    offcanvas: { classes: "", description: "Slides off screen when collapsed" },
    none: { classes: "", description: "Cannot be collapsed" },
  },
  side: {
    left: { classes: "", description: "Left-aligned sidebar" },
    right: { classes: "", description: "Right-aligned sidebar" },
  },
} as const;

export const TOMUI_SIDEBAR_DEFAULT_VARIANTS = {
  collapsible: "icon",
  side: "left",
  variant: "sidebar",
} as const;

export type TomuiSidebarVariant = keyof typeof TOMUI_SIDEBAR_VARIANTS.variant;
export type TomuiSidebarCollapsible = keyof typeof TOMUI_SIDEBAR_VARIANTS.collapsible;
export type TomuiSidebarSide = keyof typeof TOMUI_SIDEBAR_VARIANTS.side;

export type SidebarProps = JSX.HTMLAttributes<HTMLElement> & {
  children?: JSX.Element;
  class?: string;
  collapsible?: TomuiSidebarCollapsible;
  defaultOpen?: boolean;
  side?: TomuiSidebarSide;
  variant?: TomuiSidebarVariant;
};

export type SidebarSectionProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
  defaultOpen?: boolean;
  label: string;
};

export type SidebarItemProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  active?: boolean;
  children?: JSX.Element;
  class?: string;
  href?: string;
};

export function sidebarVariants(
  props: { variant?: TomuiSidebarVariant; side?: TomuiSidebarSide } = {},
): string {
  const merged = merge(TOMUI_SIDEBAR_DEFAULT_VARIANTS, props);
  return cn(
    "tomui-sidebar flex h-full w-64 shrink-0 flex-col overflow-hidden bg-tomui-base text-tomui-default",
    merged.variant === "sidebar" &&
      (merged.side === "left" ? "border-r border-tomui-line" : "border-l border-tomui-line"),
    merged.variant === "floating" && "m-2 rounded-lg border border-tomui-line shadow-lg",
    resolveVariant(
      TOMUI_SIDEBAR_VARIANTS.variant,
      merged.variant,
      TOMUI_SIDEBAR_DEFAULT_VARIANTS.variant,
    ).classes,
    resolveVariant(TOMUI_SIDEBAR_VARIANTS.side, merged.side, TOMUI_SIDEBAR_DEFAULT_VARIANTS.side)
      .classes,
  );
}

export function SidebarSection(props: SidebarSectionProps) {
  const merged = merge({ defaultOpen: true }, props);
  const rest = omit(merged, "children", "class", "defaultOpen", "label");
  const [isOpen, setIsOpen] = createSignal(merged.defaultOpen);
  return (
    <div
      data-tomui-component="SidebarSection"
      data-state={isOpen() ? "expanded" : "collapsed"}
      class={cn("tomui-sidebar-group flex min-w-0 flex-col", merged.class)}
      {...rest}
    >
      <button
        type="button"
        aria-expanded={isOpen() ? "true" : "false"}
        onClick={() => setIsOpen(!isOpen())}
        class="tomui-sidebar-group-label flex items-center justify-between px-3 pt-4 pb-2 text-sm font-medium text-tomui-subtle"
      >
        <span class="truncate">{merged.label}</span>
        <span aria-hidden="true" class={cn("transition-transform", !isOpen() && "-rotate-90")}>
          {"▾"}
        </span>
      </button>
      <Show when={isOpen()}>
        <ul class="tomui-sidebar-menu m-0 flex min-w-0 list-none flex-col gap-y-px p-0">
          {merged.children}
        </ul>
      </Show>
    </div>
  );
}

export function SidebarItem(props: SidebarItemProps) {
  const merged = merge({ active: false }, props);
  const rest = omit(merged, "active", "children", "class");
  return (
    <li data-tomui-component="SidebarItem" class="relative">
      <a
        data-active={merged.active || undefined}
        aria-current={merged.active ? "page" : undefined}
        class={cn(
          "tomui-sidebar-menu-button group/menu-button relative flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-0 text-sm font-medium no-underline!",
          "min-h-8.5 text-tomui-default",
          !merged.active && "hover:bg-tomui-tint",
          merged.active && "bg-tomui-tint",
          merged.class,
        )}
        {...rest}
      >
        {merged.children}
      </a>
    </li>
  );
}

export function Sidebar(props: SidebarProps) {
  const merged = merge(
    {
      collapsible: TOMUI_SIDEBAR_DEFAULT_VARIANTS.collapsible,
      defaultOpen: true,
      side: TOMUI_SIDEBAR_DEFAULT_VARIANTS.side,
      variant: TOMUI_SIDEBAR_DEFAULT_VARIANTS.variant,
    },
    props,
  );
  const rest = omit(merged, "children", "class", "collapsible", "defaultOpen", "side", "variant");
  const [isOpen, setIsOpen] = createSignal(merged.defaultOpen);
  return (
    <nav
      data-tomui-component="Sidebar"
      aria-label="Navigation"
      data-state={isOpen() ? "expanded" : "collapsed"}
      data-side={merged.side}
      data-variant={merged.variant}
      data-collapsible={merged.collapsible}
      class={cn(
        sidebarVariants({ side: merged.side, variant: merged.variant }),
        !isOpen() && "w-14 overflow-hidden",
        merged.class,
      )}
      {...rest}
    >
      <Show when={merged.collapsible !== "none"}>
        <button
          type="button"
          aria-expanded={isOpen() ? "true" : "false"}
          aria-label={isOpen() ? "Collapse sidebar" : "Expand sidebar"}
          onClick={() => setIsOpen(!isOpen())}
          class="tomui-sidebar-trigger m-2 flex h-8 items-center justify-center rounded-lg text-tomui-subtle hover:bg-tomui-tint"
        >
          <span aria-hidden="true">{isOpen() ? "«" : "»"}</span>
        </button>
      </Show>
      <div class="tomui-sidebar-content flex min-w-0 flex-1 flex-col overflow-y-auto px-2 py-1">
        {merged.children}
      </div>
    </nav>
  );
}
