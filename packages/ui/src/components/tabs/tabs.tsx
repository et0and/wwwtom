import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createContext, createUniqueId, For, merge, omit, Show, useContext } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
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
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
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

const hairline = colors["--color-tomui-hairline"];
const hairline70 = "color-mix(in srgb, " + hairline + " 70%, transparent)";
const recessed = colors["--color-tomui-recessed"];
const subtleText = textColors["--text-color-tomui-subtle"];
const defaultTextColor = textColors["--text-color-tomui-default"];
const tint = colors["--color-tomui-tint"];
const base = colors["--color-tomui-base"];
const line = colors["--color-tomui-line"];
const focus = colors["--color-tomui-focus"];
const focus50 = "color-mix(in srgb, " + focus + " 50%, transparent)";
const brand = colors["--color-tomui-brand"];

const styles = stylex.create({
  root: { position: "relative", isolation: "isolate", minWidth: 0, fontWeight: 500 },
  rootSegmented: { boxShadow: "0 0 0 1px " + hairline70 },
  rootSegmentedSm: { borderRadius: "0.375rem" },
  rootSegmentedBase: { borderRadius: "0.5rem" },
  /** Fixed background behind the scrollable tab list, so it never scrolls away. */
  pill: {
    position: "absolute",
    insetInline: 0,
    top: "50%",
    zIndex: 0,
    transform: "translateY(-50%)",
    borderRadius: "0.5rem",
    backgroundColor: recessed,
  },
  pillSm: { height: "1.625rem" },
  pillBase: { height: "2.25rem" },
  list: {
    position: "relative",
    display: "flex",
    minWidth: 0,
    flexShrink: 1,
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "hidden",
    scrollPaddingInline: "3rem",
  },
  listSegmented: { borderRadius: "0.5rem", backgroundColor: recessed, paddingInline: "0.125rem" },
  listSegmentedSm: { height: "1.625rem", borderRadius: "0.375rem" },
  listSegmentedBase: { height: "2.25rem" },
  listUnderline: {
    gap: "1rem",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: hairline,
    paddingBottom: "0.5rem",
  },
  listUnderlineSm: { height: "1.625rem" },
  listUnderlineBase: { height: "1.875rem" },
  tabBase: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    cursor: "pointer",
    alignItems: "center",
    borderRadius: "0.25rem",
    backgroundColor: "transparent",
    borderWidth: 0,
    whiteSpace: "nowrap",
    outlineWidth: 0,
    ":focus": { boxShadow: "0 0 0 1px " + focus50 },
    ":focus-visible": { boxShadow: "0 0 0 2px " + brand },
  },
  tabSm: { fontSize: "0.75rem", lineHeight: "1.333" },
  tabBaseSize: { fontSize: "0.875rem", lineHeight: "1.5" },
  tabSegmented: {
    marginBlock: "0.125rem",
    color: subtleText,
    ":hover": { color: defaultTextColor },
    ":focus-visible": { boxShadow: "inset 0 0 0 2px " + brand },
  },
  tabSegmentedSm: { borderRadius: "0.125rem", paddingInline: "0.5rem" },
  tabSegmentedBase: { borderRadius: "0.375rem", paddingInline: "0.625rem" },
  tabSegmentedSelected: {
    backgroundColor: base,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 0 1px " + line,
  },
  tabUnderline: {
    color: subtleText,
    ":hover": { backgroundColor: tint, color: defaultTextColor },
  },
  tabUnderlineSm: { paddingInline: "0.375rem", paddingBlock: "0.625rem" },
  tabUnderlineBase: { paddingInline: "0.5rem", paddingBlock: "0.75rem" },
  tabUnderlineSelected: { color: defaultTextColor },
});

/**
 * Flat per-axis maps, looked up by `merged.size`/`merged.variant` directly.
 * The StyleX babel plugin cannot statically resolve a style chosen by a
 * nested ternary (`cond ? (cond2 ? a : b) : c`) or by a derived function's
 * return value as the lookup key — only a single ternary over a direct
 * `merge()` prop, or a map indexed by one, compiles. See AGENTS.md note.
 */
const rootSegmentedSizeStyles = { sm: styles.rootSegmentedSm, base: styles.rootSegmentedBase };
const pillSizeStyles = { sm: styles.pillSm, base: styles.pillBase };
const listSegmentedSizeStyles = { sm: styles.listSegmentedSm, base: styles.listSegmentedBase };
const listUnderlineSizeStyles = { sm: styles.listUnderlineSm, base: styles.listUnderlineBase };
const tabFontSizeStyles = { sm: styles.tabSm, base: styles.tabBaseSize };
const tabVariantStyles = { segmented: styles.tabSegmented, underline: styles.tabUnderline };
const tabSegmentedSizeStyles = { sm: styles.tabSegmentedSm, base: styles.tabSegmentedBase };
const tabUnderlineSizeStyles = { sm: styles.tabUnderlineSm, base: styles.tabUnderlineBase };
const tabSelectedStyles = {
  segmented: styles.tabSegmentedSelected,
  underline: styles.tabUnderlineSelected,
};

export type TabsProps = TomuiTabsVariantsProps & {
  tabs?: Array<TabsItem>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  activateOnFocus?: boolean;
  orientation?: "horizontal" | "vertical";
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
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
    "style",
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

    if (event.key === "Home" || event.key === "End") {
      const edge = event.key === "Home" ? buttons[0] : buttons[buttons.length - 1];
      if (!edge) return;
      event.preventDefault();
      edge.focus();
      if (merged.activateOnFocus === true) {
        const nextValue = edge.dataset.value;
        if (nextValue !== undefined) select(nextValue);
      }
      return;
    }

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

  const contextValue: TabsContextValue = {
    activeValue,
    select,
    baseId: createUniqueId(),
  };

  const listAttrs = () => {
    const generated = stylex.attrs(
      styles.list,
      merged.variant === "segmented" ? styles.listSegmented : undefined,
      merged.variant === "segmented" ? listSegmentedSizeStyles[merged.size] : undefined,
      merged.variant === "underline" ? styles.listUnderline : undefined,
      merged.variant === "underline" ? listUnderlineSizeStyles[merged.size] : undefined,
    );
    return { ...generated, class: ["tomui-tabs-list", generated.class].filter(Boolean).join(" ") };
  };

  return (
    <TabsContext value={contextValue}>
      <Show when={items().length > 0}>
        <div
          data-tomui-component="Tabs"
          {...stylex.attrs(
            styles.root,
            merged.variant === "segmented" ? styles.rootSegmented : undefined,
            merged.variant === "segmented" ? rootSegmentedSizeStyles[merged.size] : undefined,
            merged.style,
          )}
          {...rest}
        >
          <Show when={isSegmented()}>
            <div {...stylex.attrs(styles.pill, pillSizeStyles[merged.size])} />
          </Show>
          <div
            role="tablist"
            aria-orientation={merged.orientation}
            {...listAttrs()}
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
                    id={`${contextValue.baseId}-tab-${tab.value}`}
                    aria-selected={selected() ? "true" : "false"}
                    aria-controls={`${contextValue.baseId}-panel-${tab.value}`}
                    tabindex={selected() ? 0 : -1}
                    disabled={tab.disabled}
                    {...stylex.attrs(
                      styles.tabBase,
                      tabFontSizeStyles[merged.size],
                      tabVariantStyles[merged.variant],
                      merged.variant === "segmented"
                        ? tabSegmentedSizeStyles[merged.size]
                        : tabUnderlineSizeStyles[merged.size],
                      selected() ? tabSelectedStyles[merged.variant] : undefined,
                      tab.style,
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
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  forceMount?: boolean;
};

export function TabsContent(props: TabsContentProps): JSX.Element {
  const ctx = useContext(TabsContext);
  const merged = merge({}, props);
  const rest = omit(merged, "value", "children", "style", "forceMount");
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
        {...stylex.attrs(merged.style)}
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
