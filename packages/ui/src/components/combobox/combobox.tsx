import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import {
  createContext,
  createEffect,
  createSignal,
  For,
  merge,
  onCleanup,
  Show,
  omit,
  useContext,
} from "solid-js";
import { CaretDownIcon } from "@tom/icons/CaretDown";
import { CheckIcon } from "@tom/icons/Check";
import { XIcon } from "@tom/icons/X";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_COMBOBOX_DEFAULT_VARIANTS = {
  inputSide: "right",
} as const;

export type TomuiComboboxInputSide = "right" | "top";

const lineColor = colors["--color-tomui-line"];
const hairlineColor = colors["--color-tomui-hairline"];
const focusColor = colors["--color-tomui-focus"];
/** Matches Tailwind's `ring-<color>/50` alpha modifier. StyleX needs literals. */
const focusRing = "0 0 0 1.5px color-mix(in srgb, " + focusColor + " 50%, transparent)";
const controlRing = "0 0 0 1px " + lineColor;

const styles = stylex.create({
  root: { position: "relative" },
  label: {
    display: "block",
    marginBlockEnd: "0.25rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
  },
  message: { marginBlockStart: "0.25rem", fontSize: "0.8125rem" },
  messageSubtle: { color: textColors["--text-color-tomui-subtle"] },
  messageDanger: { color: textColors["--text-color-tomui-danger"] },
  content: {
    position: "absolute",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    maxHeight: "24rem",
    minWidth: "100%",
    marginBlockStart: "0.25rem",
    overflow: "clip",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    paddingBlock: "0.375rem",
    color: textColors["--text-color-tomui-default"],
    boxShadow: controlRing + ", 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  triggerWrap: {
    position: "relative",
    display: "inline-block",
    width: "100%",
    ":has(:disabled)": { cursor: "not-allowed", opacity: 0.5 },
  },
  triggerInput: {
    width: "100%",
    borderWidth: 0,
    backgroundColor: colors["--color-tomui-control"],
    paddingInlineEnd: "3rem",
    color: textColors["--text-color-tomui-default"],
    outlineWidth: 0,
    boxShadow: controlRing,
    "::placeholder": { color: textColors["--text-color-tomui-placeholder"] },
    ":disabled": { cursor: "not-allowed" },
    ":focus": { outlineWidth: 0, boxShadow: focusRing },
  },
  iconButton: {
    position: "absolute",
    insetBlockStart: "50%",
    display: "flex",
    margin: 0,
    padding: 0,
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    transform: "translateY(-50%)",
  },
  clearButton: { insetInlineEnd: "2rem" },
  triggerButton: { insetInlineEnd: "0.5rem", color: textColors["--text-color-tomui-subtle"] },
  triggerValue: {
    position: "relative",
    display: "flex",
    width: "100%",
    alignItems: "center",
    borderWidth: 0,
    backgroundColor: colors["--color-tomui-control"],
    paddingInlineEnd: "2rem",
    color: textColors["--text-color-tomui-default"],
    outlineWidth: 0,
    boxShadow: controlRing,
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
    ":focus": { outlineWidth: 0, boxShadow: focusRing },
  },
  caret: {
    position: "absolute",
    insetBlockStart: "50%",
    insetInlineEnd: "0.5rem",
    display: "flex",
    alignItems: "center",
    color: textColors["--text-color-tomui-subtle"],
    transform: "translateY(-50%)",
  },
  multiple: {
    display: "flex",
    height: "auto",
    minHeight: "2.25rem",
    flexDirection: "column",
    gap: "0.25rem",
    borderWidth: 0,
    backgroundColor: colors["--color-tomui-control"],
    padding: "0.375rem 0.625rem",
    boxShadow: controlRing,
  },
  multipleInput: {
    width: "100%",
    borderWidth: 0,
    backgroundColor: "inherit",
    padding: "0.25rem 0.5rem",
  },
  multipleInputInline: {
    minWidth: "6.25rem",
    flexGrow: 1,
    borderWidth: 0,
    backgroundColor: "inherit",
    padding: "0.25rem 0.5rem",
  },
  chipRow: {
    display: "flex",
    flexGrow: 1,
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.375rem",
  },
  item: {
    display: "grid",
    gridTemplateColumns: "1fr 16px",
    gap: "0.5rem",
    margin: "0.375rem",
    borderRadius: radius.sm.borderRadius,
    padding: "0.375rem 0.5rem",
    fontSize: "0.875rem",
    cursor: "pointer",
    ":is([data-highlighted])": { backgroundColor: colors["--color-tomui-tint"] },
  },
  itemLabel: { gridColumnStart: "1" },
  itemCheck: { gridColumnStart: "2", display: "flex", alignItems: "center" },
  empty: {
    flexShrink: 0,
    margin: "0.375rem",
    padding: "0.5rem 1rem",
    fontSize: "0.925rem",
    lineHeight: "1rem",
    color: textColors["--text-color-tomui-subtle"],
    ":empty": { margin: 0, padding: 0 },
  },
  list: {
    minHeight: 0,
    flexGrow: 1,
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    scrollPaddingBlock: "0.5rem",
  },
  chip: {
    display: "flex",
    height: "1.5rem",
    alignItems: "center",
    gap: "0.625rem",
    borderRadius: radius.sm.borderRadius,
    backgroundColor: colors["--color-tomui-overlay"],
    paddingInlineStart: "0.5rem",
    paddingInlineEnd: "3px",
    fontSize: "0.8125rem",
    boxShadow: "0 0 0 1px " + hairlineColor,
  },
  chipRemove: {
    display: "flex",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md.borderRadius,
    backgroundColor: "transparent",
    padding: "0.25rem",
    "@media (hover: hover) and (pointer: fine)": {
      ":hover": { backgroundColor: colors["--color-tomui-fill-hover"] },
    },
  },
});

interface ComboboxContextValue {
  query: () => string;
  setQuery: (query: string) => void;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  selected: () => Array<string>;
  select: (value: string) => void;
  remove: (value: string) => void;
  clear: () => void;
  listId: string;
  activeValue: () => string | undefined;
  setActiveValue: (value: string | undefined) => void;
  registeredItems: () => Array<string>;
  registerItems: (items: Array<string>) => void;
}

const ComboboxContext = createContext<ComboboxContextValue>({
  query: () => "",
  setQuery: () => undefined,
  isOpen: () => false,
  setOpen: () => undefined,
  selected: () => [],
  select: () => undefined,
  remove: () => undefined,
  clear: () => undefined,
  listId: "tomui-combobox-list",
  activeValue: () => undefined,
  setActiveValue: () => undefined,
  registeredItems: () => [],
  registerItems: () => undefined,
});

export type ComboboxRootProps = {
  items?: Array<string>;
  value?: string | Array<string>;
  defaultValue?: string | Array<string>;
  onValueChange?: (value: string | Array<string> | undefined) => void;
  multiple?: boolean;
  children?: JSX.Element;
  label?: JSX.Element;
  required?: boolean;
  description?: JSX.Element;
  error?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Root(props: ComboboxRootProps): JSX.Element {
  const merged = merge({ multiple: false }, props);
  const [uncontrolledValue, setUncontrolledValue] = createSignal<
    string | Array<string> | undefined
  >(
    merged.defaultValue === undefined
      ? undefined
      : Array.isArray(merged.defaultValue)
        ? merged.defaultValue.map((entry) => String(entry))
        : String(merged.defaultValue),
  );
  const [query, setQuery] = createSignal("");
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(false);
  const [activeValue, setActiveValue] = createSignal<string | undefined>(undefined);
  const [registeredItems, setRegisteredItems] = createSignal<Array<string>>([]);
  const selected = (): Array<string> => {
    const value = merged.value ?? uncontrolledValue();
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [String(value)];
  };
  const setSelected = (next: string | Array<string> | undefined): void => {
    if (merged.value === undefined) setUncontrolledValue(next);
    merged.onValueChange?.(next);
  };
  const select = (item: string): void => {
    if (merged.multiple === true) {
      const current = selected();
      if (!current.includes(item)) setSelected([...current, item]);
      setQuery("");
      return;
    }
    setSelected(item);
    setQuery("");
    setUncontrolledOpen(false);
  };
  const remove = (item: string): void => {
    setSelected(selected().filter((entry) => entry !== item));
  };
  const clear = (): void => {
    setSelected(merged.multiple === true ? [] : undefined);
    setQuery("");
  };
  const value: ComboboxContextValue = {
    query,
    setQuery,
    isOpen: () => uncontrolledOpen(),
    setOpen: (open: boolean) => setUncontrolledOpen(open),
    selected,
    select,
    remove,
    clear,
    listId: "tomui-combobox-list",
    activeValue,
    setActiveValue,
    registeredItems,
    registerItems: setRegisteredItems,
  };
  return (
    <div data-tomui-component="Combobox" {...stylex.attrs(styles.root, merged.style)}>
      <Show when={merged.label !== undefined}>
        <label {...stylex.attrs(styles.label)}>
          {merged.label}
          <Show when={merged.required}>
            <span aria-hidden="true">{" *"}</span>
          </Show>
        </label>
      </Show>
      <ComboboxContext value={value}>{merged.children}</ComboboxContext>
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

export type ComboboxContentProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Content(props: ComboboxContentProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const attach = (element: HTMLDivElement): void => {
    const onOutside = (event: MouseEvent): void => {
      if (!element.contains(event.target as Node)) ctx.setOpen(false);
    };
    const moveActive = (delta: number): void => {
      const items = ctx.registeredItems();
      if (items.length === 0) return;
      const current = items.indexOf(ctx.activeValue() ?? "");
      const base = current === -1 ? (delta > 0 ? -1 : 0) : current;
      const next = (base + delta + items.length) % items.length;
      ctx.setActiveValue(items[next]);
    };
    const onKey = (event: KeyboardEvent): void => {
      const items = ctx.registeredItems();
      if (event.key === "Escape") {
        ctx.setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Home") {
        if (items.length > 0) ctx.setActiveValue(items[0]);
      } else if (event.key === "End") {
        if (items.length > 0) ctx.setActiveValue(items[items.length - 1]);
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    });
  };
  return (
    <Show when={ctx.isOpen()}>
      <div
        ref={attach}
        data-tomui-component="Combobox"
        data-tomui-part="content"
        {...stylex.attrs(styles.content, merged.style)}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type ComboboxTriggerInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onInput" | "onFocus" | "onKeyDown" | "style"
> & {
  clearLabel?: string;
  showOptionsLabel?: string;
  placeholder?: string;
  onInput?: JSX.InputEventHandler<HTMLInputElement, InputEvent> | undefined;
  onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function TriggerInput(props: ComboboxTriggerInputProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ clearLabel: "Clear selection", showOptionsLabel: "Show options" }, props);
  const rest = omit(
    merged,
    "style",
    "clearLabel",
    "showOptionsLabel",
    "placeholder",
    "value",
    "onInput",
    "onFocus",
    "onKeyDown",
  );
  return (
    <div {...stylex.attrs(styles.triggerWrap)}>
      <input
        data-tomui-component="Combobox"
        data-tomui-part="input"
        role="combobox"
        aria-expanded={ctx.isOpen() ? "true" : "false"}
        aria-controls={ctx.listId}
        aria-autocomplete="list"
        {...stylex.attrs(styles.triggerInput, merged.style)}
        placeholder={merged.placeholder}
        value={ctx.query()}
        onInput={(event) => {
          ctx.setQuery(event.currentTarget.value);
          ctx.setOpen(true);
          ctx.setActiveValue(undefined);
          merged.onInput?.(event);
        }}
        onFocus={(event) => {
          ctx.setOpen(true);
          merged.onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") ctx.setOpen(false);
          merged.onKeyDown?.(event);
        }}
        {...rest}
      />
      <button
        data-tomui-component="Combobox"
        data-tomui-part="clear"
        type="button"
        aria-label={merged.clearLabel}
        {...stylex.attrs(styles.iconButton, styles.clearButton)}
        onClick={() => ctx.clear()}
      >
        <XIcon size="sm" color="current" />
      </button>
      <button
        data-tomui-component="Combobox"
        data-tomui-part="trigger"
        type="button"
        aria-label={merged.showOptionsLabel}
        aria-expanded={ctx.isOpen() ? "true" : "false"}
        {...stylex.attrs(styles.iconButton, styles.triggerButton)}
        onClick={() => ctx.setOpen(!ctx.isOpen())}
      >
        <CaretDownIcon size="sm" color="current" />
      </button>
    </div>
  );
}

export type ComboboxTriggerValueProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  placeholder?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function TriggerValue(props: ComboboxTriggerValueProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style", "placeholder", "onClick");
  const label = (): string => {
    const first = ctx.selected()[0];
    if (first === undefined) return merged.placeholder ?? "Select…";
    return String(first);
  };
  return (
    <button
      data-tomui-component="Combobox"
      data-tomui-part="trigger"
      type="button"
      aria-haspopup="listbox"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      {...stylex.attrs(styles.triggerValue, merged.style)}
      onClick={(event) => {
        ctx.setOpen(!ctx.isOpen());
        merged.onClick?.(event);
      }}
      {...rest}
    >
      {merged.children ?? label()}
      <span {...stylex.attrs(styles.caret)}>
        <CaretDownIcon size="sm" color="current" />
      </span>
    </button>
  );
}

export type ComboboxTriggerMultipleWithInputProps = {
  placeholder?: string;
  inputSide?: TomuiComboboxInputSide;
  renderItem?: (value: string) => JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function TriggerMultipleWithInput(props: ComboboxTriggerMultipleWithInputProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ inputSide: TOMUI_COMBOBOX_DEFAULT_VARIANTS.inputSide }, props);
  return (
    <div {...stylex.attrs(styles.multiple, merged.style)}>
      <Show when={merged.inputSide === "top"}>
        <input
          {...stylex.attrs(styles.multipleInput)}
          placeholder={merged.placeholder}
          value={ctx.query()}
          aria-expanded={ctx.isOpen() ? "true" : "false"}
          aria-controls={ctx.listId}
          role="combobox"
          aria-autocomplete="list"
          onInput={(event) => {
            ctx.setQuery(event.currentTarget.value);
            ctx.setOpen(true);
          }}
        />
      </Show>
      <div {...stylex.attrs(styles.chipRow)}>
        <For each={ctx.selected()}>
          {(item) => (
            <Show
              when={merged.renderItem !== undefined}
              fallback={<Chip value={item}>{String(item)}</Chip>}
            >
              {merged.renderItem?.(item)}
            </Show>
          )}
        </For>
        <Show when={merged.inputSide === "right"}>
          <input
            {...stylex.attrs(styles.multipleInputInline)}
            placeholder={merged.placeholder}
            value={ctx.query()}
            aria-expanded={ctx.isOpen() ? "true" : "false"}
            aria-controls={ctx.listId}
            role="combobox"
            aria-autocomplete="list"
            onInput={(event) => {
              ctx.setQuery(event.currentTarget.value);
              ctx.setOpen(true);
            }}
          />
        </Show>
      </div>
    </div>
  );
}

export type ComboboxItemProps = {
  children?: JSX.Element;
  value: string;
  disabled?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Item(props: ComboboxItemProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const isSelected = (): boolean => ctx.selected().includes(merged.value);
  const isHighlighted = (): boolean => ctx.activeValue() === merged.value;
  return (
    <button
      data-tomui-component="Combobox"
      data-tomui-part="item"
      type="button"
      role="option"
      aria-selected={isSelected() ? "true" : "false"}
      data-highlighted={isHighlighted() ? "" : undefined}
      disabled={merged.disabled}
      {...stylex.attrs(styles.item, merged.style)}
      onClick={() => ctx.select(merged.value)}
      onMouseEnter={() => ctx.setActiveValue(merged.value)}
    >
      <div {...stylex.attrs(styles.itemLabel)}>{merged.children ?? String(merged.value)}</div>
      <Show when={isSelected()}>
        <span {...stylex.attrs(styles.itemCheck)}>
          <CheckIcon size="sm" color="current" />
        </span>
      </Show>
    </button>
  );
}

export type ComboboxEmptyProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Empty(props: ComboboxEmptyProps): JSX.Element {
  const merged = merge({}, props);
  return (
    <div {...stylex.attrs(styles.empty, merged.style)}>{merged.children ?? "No labels found."}</div>
  );
}

export type ComboboxListProps = {
  children?: (item: string, index: number) => JSX.Element;
  items?: Array<string>;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function List(props: ComboboxListProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  createEffect(
    () => merged.items ?? [],
    (items) => {
      ctx.registerItems(items);
    },
  );
  return (
    <div
      data-tomui-component="Combobox"
      id={ctx.listId}
      role="listbox"
      {...stylex.attrs(styles.list, merged.style)}
    >
      <For each={merged.items ?? []}>
        {(item, index) => <>{merged.children?.(item, index())}</>}
      </For>
    </div>
  );
}

export type ComboboxChipProps = {
  children?: JSX.Element;
  value?: string;
  removeLabel?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Chip(props: ComboboxChipProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ removeLabel: "Remove" }, props);
  return (
    <span data-tomui-component="Combobox" {...stylex.attrs(styles.chip, merged.style)}>
      {merged.children}
      <button
        data-tomui-component="Combobox"
        data-tomui-part="chip-remove"
        type="button"
        aria-label={merged.removeLabel}
        {...stylex.attrs(styles.chipRemove)}
        onClick={() => {
          if (merged.value !== undefined) ctx.remove(merged.value);
        }}
      >
        <XIcon size="sm" color="current" />
      </button>
    </span>
  );
}

export const Combobox = Object.assign(Root, {
  Content,
  TriggerValue,
  TriggerInput,
  TriggerMultipleWithInput,
  Chip,
  Item,
  Empty,
  List,
});
