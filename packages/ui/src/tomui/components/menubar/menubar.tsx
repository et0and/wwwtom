import type { JSX } from "@solidjs/web";
import { For, merge, omit } from "solid-js";
import { cn } from "../../utils/cn";

export const TOMUI_MENUBAR_VARIANTS = {} as const;

export const TOMUI_MENUBAR_DEFAULT_VARIANTS = {} as const;

export interface TomuiMenuBarVariantsProps {}

export function menuBarVariants(_props: TomuiMenuBarVariantsProps = {}): string {
  return cn(
    "flex rounded-lg border border-tomui-recessed bg-tomui-recessed pl-px shadow-xs transition-colors",
  );
}

export type MenuOptionProps = {
  icon: JSX.Element;
  id?: number | string;
  isActive?: number | boolean | string | undefined;
  onClick: () => void;
  tooltip: string;
};

function MenuOption(props: MenuOptionProps): JSX.Element {
  const isActive = (): boolean => props.isActive === props.id;
  return (
    <button
      data-tomui-component="MenuBar"
      data-tomui-part="option"
      type="button"
      aria-label={props.tooltip}
      title={props.tooltip}
      aria-pressed={isActive() ? "true" : "false"}
      class={cn(
        "relative -ml-px flex h-full w-11 cursor-pointer items-center justify-center rounded-md border-none bg-tomui-recessed transition-colors first:rounded-l-lg last:rounded-r-lg focus:z-3 focus:outline-none focus-visible:z-3 focus-visible:ring-2 focus-visible:ring-tomui-brand",
        isActive() && "z-2 bg-tomui-base shadow-xs transition-colors",
      )}
      onClick={() => props.onClick()}
    >
      {props.icon}
    </button>
  );
}

export type MenuBarProps = {
  class?: string;
  isActive: number | boolean | string | undefined;
  options: Array<MenuOptionProps>;
  optionIds?: boolean;
};

/** @deprecated Use `Tabs` with `variant="segmented"` instead. `MenuBar` will be removed in a future release. */
export function MenuBar(props: MenuBarProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "class", "isActive", "options", "optionIds");
  const resolvedId = (option: MenuOptionProps, index: number): number | string => {
    if (merged.optionIds === true) return option.id ?? index;
    return index;
  };
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const container = event.currentTarget as HTMLElement;
    const items = Array.from(container.querySelectorAll<HTMLElement>("button:not([disabled])"));
    const current = document.activeElement as HTMLElement | null;
    const currentIndex = current ? items.indexOf(current) : -1;
    if (currentIndex < 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = items[(currentIndex + delta + items.length) % items.length];
    next?.focus();
  };
  return (
    <nav
      data-tomui-component="MenuBar"
      class={cn(
        "isolate flex rounded-lg bg-tomui-recessed pl-px shadow-xs ring ring-tomui-line transition-colors",
        merged.class,
      )}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <For each={merged.options}>
        {(option, index) => (
          <MenuOption
            icon={option.icon}
            tooltip={option.tooltip}
            onClick={option.onClick}
            id={resolvedId(option, index())}
            isActive={merged.isActive}
          />
        )}
      </For>
    </nav>
  );
}
