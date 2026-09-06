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

export const TOMUI_INPUT_SIZE_VARIANTS = {
  xs: { classes: "h-5 px-1.5 text-xs", description: "Extra small input" },
  sm: { classes: "h-6.5 px-2 text-xs", description: "Small input" },
  base: { classes: "h-9 px-3 text-base", description: "Default input" },
  lg: { classes: "h-10 px-4 text-base", description: "Large input" },
} as const;

export const TOMUI_AUTOCOMPLETE_VARIANTS = {
  size: TOMUI_INPUT_SIZE_VARIANTS,
} as const;

export const TOMUI_AUTOCOMPLETE_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiAutocompleteSize = keyof typeof TOMUI_AUTOCOMPLETE_VARIANTS.size;

export interface TomuiAutocompleteVariantsProps {
  size?: TomuiAutocompleteSize;
}

export function autocompleteVariants(props: TomuiAutocompleteVariantsProps = {}): string {
  const merged = merge({ size: TOMUI_AUTOCOMPLETE_DEFAULT_VARIANTS.size }, props);
  return cn(
    resolveVariant(
      TOMUI_AUTOCOMPLETE_VARIANTS.size,
      merged.size,
      TOMUI_AUTOCOMPLETE_DEFAULT_VARIANTS.size,
    ).classes,
  );
}

interface AutocompleteContextValue {
  query: () => string;
  setQuery: (query: string) => void;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  activeIndex: () => number;
  setActiveIndex: (index: number) => void;
  hasError: () => boolean;
  inputId: string;
  listId: string;
  size: () => TomuiAutocompleteSize;
}

const AutocompleteContext = createContext<AutocompleteContextValue>({
  query: () => "",
  setQuery: () => undefined,
  isOpen: () => false,
  setOpen: () => undefined,
  activeIndex: () => -1,
  setActiveIndex: () => undefined,
  hasError: () => false,
  inputId: "autocomplete-input",
  listId: "autocomplete-list",
  size: () => "base",
});

export type AutocompleteProps = {
  items: Array<string>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
  class?: string;
  label?: JSX.Element;
  required?: boolean;
  description?: JSX.Element;
  error?: string;
};

function Root(props: AutocompleteProps): JSX.Element {
  const merged = merge({ items: [] as Array<string> }, props);
  const [uncontrolledQuery, setUncontrolledQuery] = createSignal(merged.defaultValue ?? "");
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
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
  const rest = omit(
    merged,
    "items",
    "value",
    "defaultValue",
    "onValueChange",
    "open",
    "onOpenChange",
    "children",
    "class",
    "label",
    "required",
    "description",
    "error",
  );
  const value: AutocompleteContextValue = {
    query,
    setQuery,
    isOpen,
    setOpen,
    activeIndex,
    setActiveIndex,
    hasError: () => merged.error !== undefined,
    inputId: "tomui-autocomplete-input",
    listId: "tomui-autocomplete-list",
    size: () => TOMUI_AUTOCOMPLETE_DEFAULT_VARIANTS.size,
  };
  void rest;
  return (
    <div data-tomui-component="Autocomplete" class={cn("relative", merged.class)}>
      <Show when={merged.label !== undefined}>
        <label class="mb-1 block text-sm font-medium">
          {merged.label}
          <Show when={merged.required}>
            <span aria-hidden="true">{" *"}</span>
          </Show>
        </label>
      </Show>
      <AutocompleteContext value={value}>{merged.children}</AutocompleteContext>
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

export type AutocompleteInputGroupProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onInput" | "onFocus" | "onKeyDown"
> & {
  class?: string;
  size?: TomuiAutocompleteSize;
  onInput?: JSX.InputEventHandler<HTMLInputElement, InputEvent> | undefined;
  onFocus?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent> | undefined;
};

function InputGroup(props: AutocompleteInputGroupProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({ size: TOMUI_AUTOCOMPLETE_DEFAULT_VARIANTS.size }, props);
  const rest = omit(merged, "class", "size", "onInput", "onFocus", "onKeyDown", "placeholder");
  return (
    <input
      data-tomui-component="Autocomplete"
      data-tomui-part="input"
      id={ctx.inputId}
      role="combobox"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      aria-controls={ctx.listId}
      aria-autocomplete="list"
      aria-activedescendant={
        ctx.activeIndex() >= 0 ? `${ctx.listId}-option-${ctx.activeIndex()}` : undefined
      }
      class={cn(
        "w-full rounded-lg bg-tomui-base text-tomui-default ring ring-tomui-line focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand",
        ctx.hasError() && "ring-tomui-danger",
        autocompleteVariants({ size: merged.size }),
        merged.class,
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
        if (event.key === "Escape") ctx.setOpen(false);
        merged.onKeyDown?.(event);
      }}
      {...rest}
    />
  );
}

export type AutocompleteContentProps = {
  children?: JSX.Element;
  class?: string;
};

function Content(props: AutocompleteContentProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  const attach = (element: HTMLDivElement): void => {
    const onOutside = (event: MouseEvent): void => {
      if (!element.contains(event.target as Node)) ctx.setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    onCleanup(() => document.removeEventListener("mousedown", onOutside));
  };
  void rest;
  return (
    <Show when={ctx.isOpen()}>
      <div
        ref={attach}
        data-tomui-component="Autocomplete"
        data-tomui-part="content"
        class={cn(
          "absolute z-50 mt-1 flex max-h-96 min-w-full flex-col rounded-lg bg-tomui-control py-1.5 text-tomui-default shadow-lg ring ring-tomui-line",
          merged.class,
        )}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type AutocompleteListProps = {
  children?: (item: string, index: number) => JSX.Element;
  class?: string;
  items?: Array<string>;
};

function List(props: AutocompleteListProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  return (
    <div
      data-tomui-component="Autocomplete"
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

export function useAutocompleteFilter(
  items: () => Array<string>,
  query: () => string,
): () => Array<string> {
  return createMemo(() => {
    const needle = query().trim().toLowerCase();
    if (needle === "") return items();
    return items().filter((item) => String(item).toLowerCase().includes(needle));
  });
}

export type AutocompleteItemProps = {
  children?: JSX.Element;
  value: string;
  class?: string;
  disabled?: boolean;
};

function Item(props: AutocompleteItemProps): JSX.Element {
  const ctx = useContext(AutocompleteContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "value", "class", "disabled");
  void rest;
  return (
    <button
      data-tomui-component="Autocomplete"
      data-tomui-part="item"
      type="button"
      role="option"
      aria-selected={ctx.query() === String(merged.value) ? "true" : "false"}
      disabled={merged.disabled}
      class="group mx-1.5 grid cursor-pointer grid-cols-[1fr_16px] gap-2 rounded px-2 py-1.5 text-base data-highlighted:bg-tomui-overlay data-selected:font-medium"
      onClick={() => {
        ctx.setQuery(String(merged.value));
        ctx.setOpen(false);
      }}
    >
      <div class="col-start-1">{merged.children ?? String(merged.value)}</div>
    </button>
  );
}

export type AutocompleteGroupLabelProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

function GroupLabel(props: AutocompleteGroupLabelProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <div class={cn("mx-1.5 px-2 py-1.5 text-sm text-tomui-strong", merged.class)} {...rest}>
      {merged.children}
    </div>
  );
}

export type AutocompleteGroupProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
};

function Group(props: AutocompleteGroupProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <div
      class={cn(
        "mt-2 border-t border-tomui-line pt-2 first:mt-0 first:border-t-0 first:pt-0",
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export type AutocompleteSeparatorProps = JSX.HTMLAttributes<HTMLHRElement> & {
  class?: string;
};

function Separator(props: AutocompleteSeparatorProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "class");
  return <hr class={cn("mx-0 my-1 h-px border-0 bg-tomui-line", merged.class)} {...rest} />;
}

export type AutocompleteEmptyProps = {
  children?: JSX.Element;
  class?: string;
};

function Empty(props: AutocompleteEmptyProps): JSX.Element {
  const merged = merge({}, props);
  return (
    <div class={cn("mx-1.5 px-4 py-2 text-sm text-tomui-subtle", merged.class)}>
      {merged.children ?? "No results found."}
    </div>
  );
}

export const Autocomplete = Object.assign(Root, {
  InputGroup,
  Content,
  Item,
  GroupLabel,
  Group,
  Separator,
  List,
  Empty,
  useFilter: useAutocompleteFilter,
});
