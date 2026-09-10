import type { JSX } from "@solidjs/web";
import {
  createContext,
  createMemo,
  createSignal,
  For,
  merge,
  onCleanup,
  Show,
  omit,
  useContext,
} from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_COMBOBOX_VARIANTS = {
  size: {
    xs: { classes: "h-5 px-1.5 text-xs", description: "Extra small combobox" },
    sm: { classes: "h-6.5 px-2 text-xs", description: "Small combobox" },
    base: { classes: "h-9 px-3 text-base", description: "Default combobox" },
    lg: { classes: "h-10 px-4 text-base", description: "Large combobox" },
  },
  inputSide: {
    right: {
      classes: "",
      description: "Input positioned inline to the right of chips",
    },
    top: {
      classes: "",
      description: "Input positioned above chips",
    },
  },
} as const;

export const TOMUI_COMBOBOX_DEFAULT_VARIANTS = {
  size: "base",
  inputSide: "right",
} as const;

export type TomuiComboboxSize = keyof typeof TOMUI_COMBOBOX_VARIANTS.size;
export type TomuiComboboxInputSide = keyof typeof TOMUI_COMBOBOX_VARIANTS.inputSide;

export interface TomuiComboboxVariantsProps {
  size?: TomuiComboboxSize;
  inputSide?: TomuiComboboxInputSide;
}

export function comboboxVariants(props: TomuiComboboxVariantsProps = {}): string {
  const merged = merge({ inputSide: TOMUI_COMBOBOX_DEFAULT_VARIANTS.inputSide }, props);
  return cn(
    resolveVariant(
      TOMUI_COMBOBOX_VARIANTS.inputSide,
      merged.inputSide,
      TOMUI_COMBOBOX_DEFAULT_VARIANTS.inputSide,
    ).classes,
  );
}

export type ComboboxInputSide = TomuiComboboxInputSide;
export type ComboboxSize = TomuiComboboxSize;

interface ComboboxContextValue {
  query: () => string;
  setQuery: (query: string) => void;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  selected: () => Array<string>;
  select: (value: string) => void;
  remove: (value: string) => void;
  clear: () => void;
  multiple: () => boolean;
  hasError: () => boolean;
  size: () => TomuiComboboxSize;
  listId: string;
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
  multiple: () => false,
  hasError: () => false,
  size: () => "base",
  listId: "tomui-combobox-list",
});

export type ComboboxRootProps = {
  items?: Array<string>;
  value?: string | Array<string>;
  defaultValue?: string | Array<string>;
  onValueChange?: (value: string | Array<string> | undefined) => void;
  multiple?: boolean;
  children?: JSX.Element;
  class?: string;
  label?: JSX.Element;
  required?: boolean;
  description?: JSX.Element;
  error?: string;
  size?: TomuiComboboxSize;
};

function Root(props: ComboboxRootProps): JSX.Element {
  const merged = merge({ multiple: false, size: TOMUI_COMBOBOX_DEFAULT_VARIANTS.size }, props);
  const toArray = (value: string | Array<string> | undefined): Array<string> => {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    return [String(value)];
  };
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
  const selected = (): Array<string> => toArray(merged.value ?? uncontrolledValue());
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
  const rest = omit(
    merged,
    "items",
    "value",
    "defaultValue",
    "onValueChange",
    "multiple",
    "children",
    "class",
    "label",
    "required",
    "description",
    "error",
    "size",
  );
  void rest;
  const value: ComboboxContextValue = {
    query,
    setQuery,
    isOpen: () => uncontrolledOpen(),
    setOpen: (open: boolean) => setUncontrolledOpen(open),
    selected,
    select,
    remove,
    clear,
    multiple: () => merged.multiple,
    hasError: () => merged.error !== undefined,
    size: () => merged.size,
    listId: "tomui-combobox-list",
  };
  return (
    <div data-tomui-component="Combobox" class={cn("relative", merged.class)}>
      <Show when={merged.label !== undefined}>
        <label class="mb-1 block text-sm font-medium">
          {merged.label}
          <Show when={merged.required}>
            <span aria-hidden="true">{" *"}</span>
          </Show>
        </label>
      </Show>
      <ComboboxContext value={value}>{merged.children}</ComboboxContext>
      <Show when={merged.description !== undefined}>
        <p class="mt-1 text-sm text-tomui-subtle">{merged.description}</p>
      </Show>
      <Show when={merged.error !== undefined}>
        <p role="alert" class="mt-1 text-sm text-tomui-danger">
          {merged.error}
        </p>
      </Show>
    </div>
  );
}

export function useComboboxFilter(
  items: () => Array<string>,
  query: () => string,
): () => Array<string> {
  return createMemo(() => {
    const needle = query().trim().toLowerCase();
    if (needle === "") return items();
    return items().filter((item) => String(item).toLowerCase().includes(needle));
  });
}

export type ComboboxContentProps = {
  children?: JSX.Element;
  class?: string;
};

function Content(props: ComboboxContentProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const attach = (element: HTMLDivElement): void => {
    const onOutside = (event: MouseEvent): void => {
      if (!element.contains(event.target as Node)) ctx.setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") ctx.setOpen(false);
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
        class={cn(
          "absolute z-50 mt-1 flex max-h-96 min-w-full flex-col rounded-lg bg-tomui-base py-1.5 text-tomui-default shadow-lg ring ring-tomui-line",
          merged.class,
        )}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type ComboboxTriggerInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onInput" | "onFocus" | "onKeyDown"
> & {
  class?: string;
  clearLabel?: string;
  showOptionsLabel?: string;
  placeholder?: string;
  onInput?: JSX.InputEventHandler<HTMLInputElement, InputEvent> | undefined;
  onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent> | undefined;
};

function TriggerInput(props: ComboboxTriggerInputProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ clearLabel: "Clear selection", showOptionsLabel: "Show options" }, props);
  const rest = omit(
    merged,
    "class",
    "clearLabel",
    "showOptionsLabel",
    "placeholder",
    "onInput",
    "onFocus",
    "onKeyDown",
  );
  return (
    <div class="relative inline-block w-full">
      <input
        data-tomui-component="Combobox"
        data-tomui-part="input"
        role="combobox"
        aria-expanded={ctx.isOpen() ? "true" : "false"}
        aria-controls={ctx.listId}
        aria-autocomplete="list"
        class={cn(
          "w-full rounded-lg bg-tomui-base pr-12 text-tomui-default ring ring-tomui-line focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand",
          merged.class,
        )}
        placeholder={merged.placeholder}
        value={ctx.query()}
        onInput={(event) => {
          ctx.setQuery(event.currentTarget.value);
          ctx.setOpen(true);
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
        class="absolute top-1/2 right-8 flex -translate-y-1/2 cursor-pointer bg-transparent p-0"
        onClick={() => ctx.clear()}
      >
        {"✕"}
      </button>
      <button
        data-tomui-component="Combobox"
        data-tomui-part="trigger"
        type="button"
        aria-label={merged.showOptionsLabel}
        aria-expanded={ctx.isOpen() ? "true" : "false"}
        class="absolute top-1/2 right-2 m-0 flex -translate-y-1/2 cursor-pointer items-center bg-transparent p-0 text-tomui-subtle"
        onClick={() => ctx.setOpen(!ctx.isOpen())}
      >
        {"▾"}
      </button>
    </div>
  );
}

export type ComboboxTriggerValueProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  children?: JSX.Element;
  class?: string;
  placeholder?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

function TriggerValue(props: ComboboxTriggerValueProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "placeholder", "onClick");
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
      class={cn(
        "relative flex w-full items-center rounded-lg bg-tomui-base pr-8 text-tomui-default ring ring-tomui-line",
        merged.class,
      )}
      onClick={(event) => {
        ctx.setOpen(!ctx.isOpen());
        merged.onClick?.(event);
      }}
      {...rest}
    >
      {merged.children ?? label()}
      <span class="absolute top-1/2 right-2 flex -translate-y-1/2 items-center text-tomui-subtle">
        {"▾"}
      </span>
    </button>
  );
}

export type ComboboxTriggerMultipleWithInputProps = {
  placeholder?: string;
  class?: string;
  inputSide?: TomuiComboboxInputSide;
  renderItem?: (value: string) => JSX.Element;
};

function TriggerMultipleWithInput(props: ComboboxTriggerMultipleWithInputProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ inputSide: TOMUI_COMBOBOX_DEFAULT_VARIANTS.inputSide }, props);
  return (
    <div
      class={cn(
        "flex h-auto min-h-9 flex-col gap-1 rounded-lg bg-tomui-base px-1.5 py-1 ring ring-tomui-line",
        comboboxVariants({ inputSide: merged.inputSide }),
        merged.class,
      )}
    >
      <Show when={merged.inputSide === "top"}>
        <input
          class="w-full border-0 bg-inherit px-2 py-1"
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
      <div class="flex flex-1 flex-wrap items-center gap-1.5">
        <For each={ctx.selected()}>
          {(item) => (
            <Show when={merged.renderItem !== undefined} fallback={<Chip>{String(item)}</Chip>}>
              {merged.renderItem?.(item)}
            </Show>
          )}
        </For>
        <Show when={merged.inputSide === "right"}>
          <input
            class="min-w-[100px] flex-1 border-0 bg-inherit px-2 py-1"
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
  class?: string;
  disabled?: boolean;
};

function Item(props: ComboboxItemProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const isSelected = (): boolean => ctx.selected().includes(merged.value);
  return (
    <button
      data-tomui-component="Combobox"
      data-tomui-part="item"
      type="button"
      role="option"
      aria-selected={isSelected() ? "true" : "false"}
      disabled={merged.disabled}
      class={cn(
        "group mx-1.5 grid cursor-pointer grid-cols-[1fr_16px] gap-2 rounded px-2 py-1.5 text-base data-disabled:cursor-not-allowed",
        merged.class,
      )}
      onClick={() => ctx.select(merged.value)}
    >
      <div class="col-start-1">{merged.children ?? String(merged.value)}</div>
      <Show when={isSelected()}>
        <span class="col-start-2 flex items-center">{"✓"}</span>
      </Show>
    </button>
  );
}

export type ComboboxEmptyProps = {
  children?: JSX.Element;
  class?: string;
};

function Empty(props: ComboboxEmptyProps): JSX.Element {
  const merged = merge({}, props);
  return (
    <div class={cn("mx-1.5 shrink-0 px-4 py-2 text-sm text-tomui-subtle", merged.class)}>
      {merged.children ?? "No labels found."}
    </div>
  );
}

export type ComboboxListProps = {
  children?: (item: string, index: number) => JSX.Element;
  class?: string;
  items?: Array<string>;
};

function List(props: ComboboxListProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  return (
    <div
      data-tomui-component="Combobox"
      id={ctx.listId}
      role="listbox"
      class={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", merged.class)}
    >
      <For each={merged.items ?? []}>
        {(item, index) => <>{merged.children?.(item, index())}</>}
      </For>
    </div>
  );
}

export type ComboboxGroupLabelProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

function GroupLabel(props: ComboboxGroupLabelProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <div class={cn("mx-1.5 px-2 py-1.5 text-sm text-tomui-subtle", merged.class)} {...rest}>
      {merged.children}
    </div>
  );
}

export type ComboboxGroupProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

function Group(props: ComboboxGroupProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <div
      class={cn(
        "mt-2 border-t border-tomui-hairline pt-2 first:mt-0 first:border-t-0 first:pt-0",
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export type ComboboxChipProps = {
  children?: JSX.Element;
  value?: string;
  class?: string;
  removeLabel?: string;
};

function Chip(props: ComboboxChipProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({ removeLabel: "Remove" }, props);
  return (
    <span
      data-tomui-component="Combobox"
      class={cn(
        "flex h-6 items-center gap-2.5 rounded-sm bg-tomui-overlay pr-[3px] pl-2 text-sm ring-1 ring-tomui-hairline",
        merged.class,
      )}
    >
      {merged.children}
      <button
        data-tomui-component="Combobox"
        data-tomui-part="chip-remove"
        type="button"
        aria-label={merged.removeLabel}
        class="flex cursor-pointer rounded-md bg-transparent p-1 hover:bg-tomui-fill-hover"
        onClick={() => {
          if (merged.value !== undefined) ctx.remove(merged.value);
        }}
      >
        {"✕"}
      </button>
    </span>
  );
}

export type ComboboxInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "onInput"> & {
  class?: string;
  onInput?: JSX.InputEventHandler<HTMLInputElement, InputEvent> | undefined;
};

function ComboboxInput(props: ComboboxInputProps): JSX.Element {
  const ctx = useContext(ComboboxContext);
  const merged = merge({}, props);
  const rest = omit(merged, "class", "onInput");
  return (
    <input
      class={cn("mx-0 -mt-1.5 w-full shrink-0 rounded-b-none", merged.class)}
      value={ctx.query()}
      role="combobox"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      aria-controls={ctx.listId}
      aria-autocomplete="list"
      onInput={(event) => {
        ctx.setQuery(event.currentTarget.value);
        ctx.setOpen(true);
        merged.onInput?.(event);
      }}
      {...rest}
    />
  );
}

export const Combobox = Object.assign(Root, {
  Content,
  TriggerValue,
  TriggerInput,
  TriggerMultipleWithInput,
  Chip,
  Item,
  Input: ComboboxInput,
  Empty,
  GroupLabel,
  Group,
  List,
  useFilter: useComboboxFilter,
});
