import type { JSX } from "@solidjs/web";
import { createContext, For, merge, omit, Show, useContext } from "solid-js";
import { cn } from "../../utils/cn";
import { createControllableSignal } from "../../utils/state";

export const TOMUI_TABS_VARIANTS = {
  variant: ["segmented", "underline"],
  size: ["base", "sm"],
} as const;

export const TOMUI_TABS_DEFAULT_VARIANTS = {
  variant: "segmented",
  size: "base",
} as const;

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

interface TabsContextValue {
  activeValue: () => string | undefined;
  select: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue>({
  activeValue: () => undefined,
  select: () => undefined,
  baseId: "",
});

export type TabsProps = TomuiTabsVariantsProps & {
  tabs?: Array<TabsItem>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  activateOnFocus?: boolean;
  orientation?: "horizontal" | "vertical";
  class?: string;
  listClassName?: string;
  children?: JSX.Element;
};

export function Tabs(props: TabsProps): JSX.Element {
  const merged = merge(
    {
      variant: TOMUI_TABS_DEFAULT_VARIANTS.variant,
      size: TOMUI_TABS_DEFAULT_VARIANTS.size,
      activateOnFocus: false,
      orientation: "horizontal" as const,
    },
    props,
  );
  const rest = omit(
    merged,
    "tabs",
    "value",
    "defaultValue",
    "onValueChange",
    "activateOnFocus",
    "orientation",
    "class",
    "listClassName",
    "variant",
    "size",
    "children",
  );

  const items = (): Array<TabsItem> => merged.tabs ?? [];
  const fallbackValue = (): string | undefined => items()[0]?.value;

  const signal = createControllableSignal<string>({
    value: () => merged.value,
    defaultValue: merged.defaultValue ?? fallbackValue(),
    onChange: (next) => merged.onValueChange?.(next),
  });

  const activeValue = (): string | undefined => signal.value() ?? fallbackValue();

  const select = (next: string): void => {
    signal.set(next);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const list = event.currentTarget as HTMLElement;
    const buttons = Array.from(
      list.querySelectorAll<HTMLButtonElement>("[role='tab']:not([disabled])"),
    );
    const current = document.activeElement as HTMLElement | null;
    const currentIndex = current ? buttons.indexOf(current as HTMLButtonElement) : -1;
    if (currentIndex < 0) return;

    const delta = getDelta(event, merged.orientation);
    if (delta === 0) return;

    event.preventDefault();
    const next = buttons[(currentIndex + delta + buttons.length) % buttons.length];
    next?.focus();
    if (merged.activateOnFocus === true) {
      const nextValue = next?.dataset.value;
      if (nextValue !== undefined) select(nextValue);
    }
  };

  const isSegmented = (): boolean => merged.variant === "segmented";
  const isUnderline = (): boolean => merged.variant === "underline";
  const isSm = (): boolean => merged.size === "sm";

  const contextValue: TabsContextValue = {
    activeValue,
    select,
    baseId: "tabs",
  };

  return (
    <TabsContext value={contextValue}>
      <Show when={items().length > 0}>
        <div
          data-tomui-component="Tabs"
          class={cn(
            "relative isolate min-w-0 font-medium",
            isSegmented() &&
              (isSm() ? "rounded-md" : "rounded-lg") + " ring ring-tomui-hairline/70",
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
            aria-orientation={merged.orientation}
            class={cn(
              "tomui-tabs-list relative flex min-w-0 shrink scroll-px-(--scroll-fade-width) items-stretch overflow-x-auto overflow-y-hidden [--scroll-fade-width:3rem]",
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
                    aria-controls={`${contextValue.baseId}-panel-${tab.value}`}
                    tabindex={selected() ? 0 : -1}
                    disabled={tab.disabled}
                    class={cn(
                      "relative z-2 flex cursor-pointer items-center rounded bg-transparent whitespace-nowrap focus:ring-tomui-focus/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand",
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
      {merged.children}
    </TabsContext>
  );
}

export type TabsContentProps = {
  value: string;
  children?: JSX.Element;
  class?: string;
  forceMount?: boolean;
};

export function TabsContent(props: TabsContentProps): JSX.Element {
  const ctx = useContext(TabsContext);
  const merged = merge({}, props);
  const rest = omit(merged, "value", "children", "class", "forceMount");
  const selected = (): boolean => ctx.activeValue() === merged.value;

  return (
    <Show when={merged.forceMount || selected()}>
      <div
        data-tomui-component="Tabs"
        data-tomui-part="panel"
        id={`${ctx.baseId}-panel-${merged.value}`}
        role="tabpanel"
        aria-labelledby={`${ctx.baseId}-tab-${merged.value}`}
        hidden={!selected()}
        class={merged.class}
        {...rest}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export const TabsObj = Object.assign(Tabs, {
  Content: TabsContent,
});

function getDelta(event: KeyboardEvent, orientation: "horizontal" | "vertical"): number {
  if (event.key === "ArrowRight") return 1;
  if (event.key === "ArrowLeft") return -1;
  if (orientation === "vertical" && event.key === "ArrowDown") return 1;
  if (orientation === "vertical" && event.key === "ArrowUp") return -1;
  return 0;
}
