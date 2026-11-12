import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import {
  createContext,
  createSignal,
  createUniqueId,
  For,
  merge,
  onCleanup,
  Show,
  omit,
  useContext,
} from "solid-js";
import { CheckIcon } from "@tom/icons/Check";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs, fontWeightControl } from "../../styles/typography.stylex";
import { inputVariants, type MidoriInputSize } from "../input/input";

export const MIDORI_AUTOCOMPLETE_DEFAULT_VARIANTS = {
  size: "base",
} as const;

/** The input chrome is shared with Input, so the sizes match. */
export type MidoriAutocompleteSize = MidoriInputSize;

export interface MidoriAutocompleteVariantsProps {
  size?: MidoriAutocompleteSize;
}

const styles = stylex.create({
  root: { position: "relative" },
  label: {
    display: "block",
    marginBottom: "0.25rem",
    fontSize: fontSizeSm.fontSize,
    fontWeight: fontWeightControl.fontWeight,
  },
  message: { marginTop: "0.25rem", fontSize: fontSizeXs.fontSize },
  messageSubtle: { color: textColors["--text-color-midori-subtle"] },
  messageDanger: { color: textColors["--text-color-midori-danger"] },
  content: {
    position: "absolute",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    maxHeight: "24rem",
    minWidth: "100%",
    marginTop: "0.25rem",
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors["--color-midori-layer-01"],
    padding: "2px",
    color: textColors["--text-color-midori-default"],
    boxShadow: elevation["--elevation-midori-floating"],
  },
  list: {
    minHeight: 0,
    flexGrow: 1,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    scrollPaddingBlock: "0.5rem",
  },
  item: {
    display: "grid",
    gridTemplateColumns: "1fr 16px",
    gap: "0.5rem",
    height: "1.75rem",
    alignItems: "center",
    borderRadius: radius.sm,
    paddingInline: "0.5rem",
    fontSize: fontSizeSm.fontSize,
    cursor: "pointer",
    ":is([data-selected])": { fontWeight: 530 },
    ":is([data-highlighted])": { backgroundColor: colors["--color-midori-overlay-hover"] },
  },
  itemLabel: { gridColumnStart: "1" },
  itemCheck: { gridColumnStart: "2", display: "flex", alignItems: "center" },
  empty: {
    padding: "0.5rem 0.75rem",
    fontSize: fontSizeXs.fontSize,
    color: textColors["--text-color-midori-subtle"],
  },
});

interface AutocompleteContextValue {
  items: () => Array<string>;
  query: () => string;
  setQuery: (query: string) => void;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  activeIndex: () => number;
  setActiveIndex: (index: number) => void;
  activeValue: () => string | undefined;
  setActiveValue: (value: string) => void;
  itemsLength: () => number;
  hasError: () => boolean;
  inputId: string;
  listId: string;
}

const AutocompleteContext = createContext<AutocompleteContextValue>({
  items: () => [],
  query: () => "",
  setQuery: () => undefined,
  isOpen: () => false,
  setOpen: () => undefined,
  activeIndex: () => -1,
  setActiveIndex: () => undefined,
  activeValue: () => undefined,
  setActiveValue: () => undefined,
  itemsLength: () => 0,
  hasError: () => false,
  inputId: "autocomplete-input",
  listId: "autocomplete-list",
});

export type AutocompleteProps = {
  items: Array<string>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  label?: JSX.Element;
  required?: boolean;
  description?: JSX.Element;
  error?: string;
};

function Root(props: AutocompleteProps): JSX.Element {
  const merged = merge({ items: [] as Array<string>, defaultOpen: false }, props);
  const [uncontrolledQuery, setUncontrolledQuery] = createSignal(merged.defaultValue ?? "");
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(merged.defaultOpen);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const inputId = createUniqueId();
  const listId = createUniqueId();
  const query = (): string => merged.value ?? uncontrolledQuery();
  const setQuery = (next: string): void => {
    if (merged.value === undefined) setUncontrolledQuery(next);
    merged.onValueChange?.(next);
  };
  const isOpen = (): boolean => merged.open ?? uncontrolledOpen();
  const setOpen = (next: boolean): void => {
    if (merged.open === undefined) setUncontrolledOpen(next);
    merged.onOpenChange?.(next);
  };
  const filteredItems = (): Array<string> => {
    const term = query().trim().toLowerCase();
    if (term === "") return merged.items;
    return merged.items.filter((item) => item.toLowerCase().includes(term));
  };
  const value: AutocompleteContextValue = {
    items: filteredItems,
    query,
    setQuery,
    isOpen,
    setOpen,
    activeIndex,
    setActiveIndex,
    activeValue: () => filteredItems()[activeIndex()],
    setActiveValue: (next) => {
      const index = filteredItems().indexOf(next);
      if (index !== -1) setActiveIndex(index);
    },
    itemsLength: () => filteredItems().length,
    hasError: () => merged.error !== undefined,
    inputId,
    listId,
  };
  return (
    <div data-midori-component="Autocomplete" {...stylex.attrs(styles.root, merged.style)}>
      <Show when={merged.label !== undefined}>
        <label for={inputId} {...stylex.attrs(styles.label)}>
          {merged.label}
          <Show when={merged.required}>
            <span aria-hidden="true">{" *"}</span>
          </Show>
        </label>
      </Show>
      <AutocompleteContext value={value}>{merged.children}</AutocompleteContext>
      <Show when={merged.description !== undefined}>
        <p {...stylex.attrs(styles.message, styles.messageSubtle)}>{merged.description}</p>
      </Show>
      <Show when={merged.error !== undefined}>
        <p role="alert" {...stylex.attrs(styles.message, styles.messageDanger)}>
          {merged.error}
        </p>
      </Show>
    </div>
  );
}

export type AutocompleteInputGroupProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onInput" | "onFocus" | "onKeyDown" | "style"
> & {
  size?: MidoriAutocompleteSize;
  onInput?: JSX.InputEventHandler<HTMLInputElement, InputEvent> | undefined;
  onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function InputGroup(props: AutocompleteInputGroupProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({ size: MIDORI_AUTOCOMPLETE_DEFAULT_VARIANTS.size }, props);
  const rest = omit(
    merged,
    "style",
    "size",
    "value",
    "onInput",
    "onFocus",
    "onKeyDown",
    "placeholder",
  );
  return (
    <input
      data-midori-component="Autocomplete"
      data-midori-part="input"
      id={ctx.inputId}
      role="combobox"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      aria-controls={ctx.listId}
      aria-autocomplete="list"
      aria-activedescendant={
        ctx.activeIndex() >= 0 ? `${ctx.listId}-option-${ctx.activeIndex()}` : undefined
      }
      {...stylex.attrs(
        ...inputVariants({
          size: merged.size,
          variant: ctx.hasError() ? "error" : "default",
          focusIndicator: true,
        }),
        merged.style,
      )}
      placeholder={merged.placeholder}
      value={ctx.query()}
      onInput={(event) => {
        ctx.setQuery(event.currentTarget.value);
        ctx.setOpen(true);
        ctx.setActiveIndex(-1);
        merged.onInput?.(event);
      }}
      onFocus={(event) => {
        ctx.setOpen(true);
        merged.onFocus?.(event);
      }}
      onKeyDown={(event) => {
        const length = ctx.itemsLength();
        if (event.key === "Escape") {
          ctx.setOpen(false);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          ctx.setOpen(true);
          if (length > 0) {
            ctx.setActiveIndex(ctx.activeIndex() + 1 >= length ? 0 : ctx.activeIndex() + 1);
          }
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          ctx.setOpen(true);
          if (length > 0) {
            ctx.setActiveIndex(ctx.activeIndex() <= 0 ? length - 1 : ctx.activeIndex() - 1);
          }
        } else if (event.key === "Enter") {
          const active = ctx.activeValue();
          if (active !== undefined) {
            event.preventDefault();
            ctx.setQuery(active);
            ctx.setOpen(false);
          }
        } else if (event.key === "Home") {
          event.preventDefault();
          if (length > 0) ctx.setActiveIndex(0);
        } else if (event.key === "End") {
          event.preventDefault();
          if (length > 0) ctx.setActiveIndex(length - 1);
        }
        merged.onKeyDown?.(event);
      }}
      {...rest}
    />
  );
}

export type AutocompleteContentProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Content(props: AutocompleteContentProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  const attach = (element: HTMLDivElement): void => {
    const onOutside = (event: MouseEvent): void => {
      if (!element.contains(event.target as Node)) ctx.setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    onCleanup(() => document.removeEventListener("mousedown", onOutside));
  };
  return (
    <Show when={ctx.isOpen()}>
      <div
        ref={attach}
        data-midori-component="Autocomplete"
        data-midori-part="content"
        {...stylex.attrs(styles.content, merged.style)}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type AutocompleteListProps = {
  children?: (item: string, index: number) => JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function List(props: AutocompleteListProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  return (
    <div
      data-midori-component="Autocomplete"
      id={ctx.listId}
      role="listbox"
      {...stylex.attrs(styles.list, merged.style)}
    >
      <For each={ctx.items()}>{(item, index) => <>{merged.children?.(item, index())}</>}</For>
    </div>
  );
}

export type AutocompleteItemProps = {
  children?: JSX.Element;
  value: string;
  disabled?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Item(props: AutocompleteItemProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  const isHighlighted = (): boolean => ctx.activeValue() === merged.value;
  return (
    <button
      data-midori-component="Autocomplete"
      data-midori-part="item"
      type="button"
      role="option"
      aria-selected={ctx.query() === String(merged.value) ? "true" : "false"}
      data-selected={ctx.query() === String(merged.value) ? "" : undefined}
      data-highlighted={isHighlighted() ? "" : undefined}
      disabled={merged.disabled}
      {...stylex.attrs(styles.item, merged.style)}
      onClick={() => {
        ctx.setQuery(String(merged.value));
        ctx.setOpen(false);
      }}
      onMouseEnter={() => ctx.setActiveValue(merged.value)}
    >
      <div {...stylex.attrs(styles.itemLabel)}>{merged.children ?? String(merged.value)}</div>
      {/* The old group-data-selected rule only had room to switch display, so
          rendering the mark conditionally is equivalent. */}
      <Show when={ctx.query() === String(merged.value)}>
        <span {...stylex.attrs(styles.itemCheck)}>
          <CheckIcon size="sm" color="current" />
        </span>
      </Show>
    </button>
  );
}

export type AutocompleteEmptyProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Empty(props: AutocompleteEmptyProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  return (
    <Show when={ctx.itemsLength() === 0}>
      <div {...stylex.attrs(styles.empty, merged.style)}>
        {merged.children ?? "No results found."}
      </div>
    </Show>
  );
}

export const Autocomplete = Object.assign(Root, {
  InputGroup,
  Content,
  Item,
  List,
  Empty,
});
