import type { JSX } from "@solidjs/web";
import { createSignal, For, merge, Show, omit } from "solid-js";
import { cn } from "../../utils/cn";

export const TOMUI_TABS_VARIANTS = {
  variant: ["segmented", "underline"],
  size: ["base", "sm"],
} as const;

export const TOMUI_TABS_DEFAULT_VARIANTS = {
  variant: "segmented",
  size: "base",
} as const;

export const TOMUI_TABS_STYLING = {
  container: {
    height: 34,
    borderRadius: 8,
    background: "color-accent",
    padding: 1,
  },
  tab: {
    paddingX: 10,
    verticalMargin: 1,
    fontSize: 16,
    fontWeight: 500,
    borderRadius: 8,
    activeColor: "text-color-surface",
    inactiveColor: "text-color-label",
  },
  indicator: {
    background: "color-surface-secondary",
    ring: "color-color-2",
    borderRadius: 6,
    shadow: "shadow-sm",
  },
} as const;

export interface TabsLabels {
  scrollStart?: string;
  scrollEnd?: string;
}

export interface TomuiTabsVariantsProps {
  variant?: (typeof TOMUI_TABS_VARIANTS.variant)[number];
  size?: (typeof TOMUI_TABS_VARIANTS.size)[number];
}

export type TabsItem = {
  value: string;
  label: JSX.Element;
  class?: string;
  disabled?: boolean;
};

export type TabsProps = TomuiTabsVariantsProps & {
  tabs?: Array<TabsItem>;
  value?: string;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  activateOnFocus?: boolean;
  class?: string;
  listClassName?: string;
  indicatorClassName?: string;
  labels?: TabsLabels;
};

export function Tabs(props: TabsProps): JSX.Element {
  const merged = merge(
    {
      variant: TOMUI_TABS_DEFAULT_VARIANTS.variant,
      size: TOMUI_TABS_DEFAULT_VARIANTS.size,
      activateOnFocus: false,
    },
    props,
  );
  const rest = omit(
    merged,
    "tabs",
    "value",
    "selectedValue",
    "onValueChange",
    "activateOnFocus",
    "class",
    "listClassName",
    "indicatorClassName",
    "labels",
    "variant",
    "size",
  );
  const items = (): Array<TabsItem> => merged.tabs ?? [];
  const fallbackValue = (): string | undefined => items()[0]?.value;
  const [uncontrolled, setUncontrolled] = createSignal(merged.selectedValue ?? fallbackValue());
  const activeValue = (): string | undefined => merged.value ?? uncontrolled() ?? fallbackValue();
  const select = (next: string): void => {
    if (merged.value === undefined) setUncontrolled(next);
    merged.onValueChange?.(next);
  };
  const isSegmented = (): boolean => merged.variant === "segmented";
  const isUnderline = (): boolean => merged.variant === "underline";
  const isSm = (): boolean => merged.size === "sm";
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const list = event.currentTarget as HTMLElement;
    const buttons = Array.from(
      list.querySelectorAll<HTMLButtonElement>("[role='tab']:not([disabled])"),
    );
    const current = document.activeElement as HTMLElement | null;
    const currentIndex = current ? buttons.indexOf(current as HTMLButtonElement) : -1;
    if (currentIndex < 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = buttons[(currentIndex + delta + buttons.length) % buttons.length];
    next?.focus();
    if (merged.activateOnFocus === true) {
      const nextValue = next?.dataset.value;
      if (nextValue !== undefined) select(nextValue);
    }
  };
  return (
    <Show when={items().length > 0}>
      <div
        data-tomui-component="Tabs"
        class={cn(
          "relative isolate min-w-0 font-medium",
          isSegmented() && (isSm() ? "rounded-md" : "rounded-lg") + " ring ring-tomui-hairline/70",
          merged.class,
        )}
        {...rest}
      >
        <Show when={isSegmented()}>
          <div
            class={cn(
              "absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-tomui-recessed",
              isSm() ? "h-6.5" : "h-9",
            )}
          />
        </Show>
        <div
          role="tablist"
          aria-orientation="horizontal"
          class={cn(
            "tomui-tabs-list relative flex min-w-0 shrink items-stretch overflow-x-auto overflow-y-hidden",
            isSegmented() && "rounded-lg bg-tomui-recessed px-0.5",
            isSegmented() && (isSm() ? "h-6.5 rounded-md" : "h-9"),
            isUnderline() && "gap-4 border-b border-tomui-hairline pb-2",
            isUnderline() && (isSm() ? "h-6.5" : "h-7.5"),
            merged.listClassName,
          )}
          onKeyDown={handleKeyDown}
        >
          <For each={items()}>
            {(tab) => {
              const selected = (): boolean => activeValue() === tab.value;
              return (
                <button
                  data-tomui-component="Tabs"
                  data-tomui-part="tab"
                  data-value={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected() ? "true" : "false"}
                  tabindex={selected() ? 0 : -1}
                  disabled={tab.disabled}
                  class={cn(
                    "relative z-2 flex cursor-pointer items-center rounded bg-transparent whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand",
                    isSm() ? "text-xs" : "text-base",
                    isSegmented() &&
                      "my-0.5 text-tomui-subtle hover:text-tomui-default focus-visible:ring-inset aria-selected:text-tomui-default",
                    isSegmented() && (isSm() ? "rounded-sm px-2" : "rounded-md px-2.5"),
                    isUnderline() &&
                      "text-tomui-subtle hover:bg-tomui-tint hover:text-tomui-default aria-selected:font-medium aria-selected:text-tomui-default aria-selected:hover:bg-tomui-tint",
                    isUnderline() && (isSm() ? "px-1.5 py-2.5" : "px-2 py-3"),
                    selected() && isSegmented() && "bg-tomui-base shadow-sm ring ring-tomui-line",
                    tab.class,
                  )}
                  onClick={() => select(tab.value)}
                >
                  {tab.label}
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}
