import { createMemo, createSignal, For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";

export const TOMUI_COMMAND_PALETTE_VARIANTS = {
  root: {
    classes:
      "fixed top-[10vh] left-1/2 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg bg-tomui-base ring ring-tomui-line",
    description: "Command palette dialog container",
  },
  input: {
    classes:
      "w-full bg-transparent px-4 py-3 text-base text-tomui-default outline-none placeholder:text-tomui-subtle",
    description: "Command palette search input",
  },
  list: {
    classes: "max-h-80 overflow-y-auto p-1.5",
    description: "Command palette results list",
  },
  item: {
    classes: "flex w-full items-center gap-2 rounded px-2 py-1.5 text-base text-tomui-default",
    description: "Command palette result item",
  },
} as const;

export type CommandPaletteItem = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export type CommandPaletteProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  class?: string;
  open?: boolean;
  items?: ReadonlyArray<CommandPaletteItem>;
  placeholder?: string;
  emptyMessage?: string;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (item: CommandPaletteItem) => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  const merged = merge(
    {
      open: false,
      items: [] as ReadonlyArray<CommandPaletteItem>,
      placeholder: "Search...",
      emptyMessage: "No results found",
    },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "class",
    "open",
    "items",
    "placeholder",
    "emptyMessage",
    "onOpenChange",
    "onSelect",
  );
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    const visible = merged.items.filter(
      (item) => needle === "" || item.label.toLowerCase().includes(needle),
    );
    return visible;
  });
  const selectable = createMemo(() => filtered().filter((item) => !item.disabled));
  const close = () => merged.onOpenChange?.(false);
  const choose = (item: CommandPaletteItem | undefined) => {
    if (!item || item.disabled) return;
    merged.onSelect?.(item);
    close();
  };
  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event) => {
    const list = selectable();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (list.length === 0 ? 0 : (index + 1) % list.length));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (list.length === 0 ? 0 : (index - 1 + list.length) % list.length));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(list[activeIndex()]);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    setQuery(event.currentTarget.value);
    setActiveIndex(0);
  };
  return (
    <Show when={merged.open}>
      <div
        class="fixed inset-0 bg-tomui-overlay opacity-80"
        data-tomui-component="CommandPaletteBackdrop"
        onClick={close}
        aria-hidden="true"
      />
      <div
        data-tomui-component="CommandPalette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        class={cn(TOMUI_COMMAND_PALETTE_VARIANTS.root.classes, merged.class)}
        {...rest}
      >
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="tomui-command-palette-list"
          aria-activedescendant={selectable()[activeIndex()]?.id}
          placeholder={merged.placeholder}
          value={query()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          class={TOMUI_COMMAND_PALETTE_VARIANTS.input.classes}
        />
        <div
          id="tomui-command-palette-list"
          role="listbox"
          class={TOMUI_COMMAND_PALETTE_VARIANTS.list.classes}
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <p class="px-2 py-6 text-center text-sm text-tomui-subtle">{merged.emptyMessage}</p>
            }
          >
            <For each={filtered()}>
              {(item) => {
                const selectableIndex = createMemo(() =>
                  selectable().findIndex((entry) => entry.id === item.id),
                );
                const isActive = () => selectableIndex() === activeIndex() && !item.disabled;
                return (
                  <button
                    id={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive() ? "true" : "false"}
                    disabled={item.disabled}
                    data-active={isActive() ? "true" : undefined}
                    class={cn(
                      TOMUI_COMMAND_PALETTE_VARIANTS.item.classes,
                      isActive() && "bg-tomui-tint",
                      item.disabled && "cursor-not-allowed opacity-50",
                    )}
                    onClick={() => choose(item)}
                    onMouseMove={() => {
                      const index = selectableIndex();
                      if (index >= 0) setActiveIndex(index);
                    }}
                  >
                    <span class="truncate">{item.label}</span>
                    <Show when={item.hint}>
                      <span class="ml-auto shrink-0 text-xs text-tomui-subtle">{item.hint}</span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>
        {merged.children}
      </div>
    </Show>
  );
}
