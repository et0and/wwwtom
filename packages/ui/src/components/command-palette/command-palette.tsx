import * as stylex from "@stylexjs/stylex";
import { createMemo, createSignal, For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";
import { createDismissableLayer } from "../../utils/dismissable";
import {
  createFocusScope,
  createHideOutside,
  createPreventScroll,
  focusWithoutScrolling,
} from "../../utils/focus";

const styles = stylex.create({
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: colors["--color-midori-overlay-scrim"],
    transitionProperty: "opacity",
    transitionDuration: "150ms",
    ":is([data-ending-style])": { opacity: 0 },
    ":is([data-starting-style])": { opacity: 0 },
  },
  root: {
    position: "fixed",
    top: "12vh",
    left: "50%",
    width: "calc(100% - 2rem)",
    maxWidth: "40rem",
    overflow: "hidden",
    borderWidth: "0.5px",
    borderStyle: "solid",
    borderColor: colors["--color-midori-hairline"],
    borderRadius: radius.md,
    backgroundColor: colors["--color-midori-layer-01"],
    boxShadow: elevation["--elevation-midori-overlay"],
    transform: "translateX(-50%)",
  },
  input: {
    width: "100%",
    borderWidth: 0,
    borderBottomWidth: "0.5px",
    borderBottomStyle: "solid",
    borderBottomColor: colors["--color-midori-hairline"],
    backgroundColor: "transparent",
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
    fontSize: fontSizeSm.fontSize,
    fontWeight: 440,
    color: textColors["--text-color-midori-default"],
    outlineWidth: 0,
    outlineStyle: "none",
    "::placeholder": { color: textColors["--text-color-midori-placeholder"] },
  },
  list: {
    maxHeight: "20rem",
    overflowY: "auto",
    padding: "2px",
  },
  empty: {
    padding: "1.5rem 0.5rem",
    textAlign: "center",
    fontSize: fontSizeXs.fontSize,
    color: textColors["--text-color-midori-subtle"],
  },
  item: {
    display: "flex",
    width: "100%",
    height: "1.75rem",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: radius.sm,
    paddingInline: "0.5rem",
    textAlign: "left",
    fontSize: fontSizeSm.fontSize,
    color: textColors["--text-color-midori-default"],
    ":is([data-active])": { backgroundColor: colors["--color-midori-overlay-hover"] },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
  itemLabel: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemHint: {
    marginInlineStart: "auto",
    flexShrink: 0,
    fontSize: fontSizeXs.fontSize,
    color: textColors["--text-color-midori-subtle"],
  },
});

export type CommandPaletteItem = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export type CommandPaletteProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onSelect" | "style"> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  open?: boolean;
  defaultOpen?: boolean;
  items?: ReadonlyArray<CommandPaletteItem>;
  placeholder?: string;
  emptyMessage?: string;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (item: CommandPaletteItem) => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  const merged = merge(
    {
      defaultOpen: false,
      items: [] as ReadonlyArray<CommandPaletteItem>,
      placeholder: "Search...",
      emptyMessage: "No results found",
    },
    props,
  );
  const rest = omit(
    merged,
    "children",
    "style",
    "open",
    "defaultOpen",
    "items",
    "placeholder",
    "emptyMessage",
    "onOpenChange",
    "onSelect",
  );

  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(merged.defaultOpen);
  const [contentEl, setContentEl] = createSignal<HTMLElement>();
  const isOpen = (): boolean => merged.open ?? uncontrolledOpen();

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    return merged.items.filter(
      (item) => needle === "" || item.label.toLowerCase().includes(needle),
    );
  });
  const selectable = createMemo(() => filtered().filter((item) => !item.disabled));

  const close = () => {
    if (merged.open === undefined) setUncontrolledOpen(false);
    merged.onOpenChange?.(false);
  };

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

  createDismissableLayer(contentEl, {
    enabled: isOpen,
    onDismiss: () => close(),
  });

  createFocusScope(contentEl, {
    enabled: isOpen,
    trapFocus: true,
    onMountAutoFocus: (e) => {
      e.preventDefault();
      const input = contentEl()?.querySelector<HTMLInputElement>("input");
      if (input) focusWithoutScrolling(input);
    },
  });

  createHideOutside({
    enabled: isOpen,
    targets: () => [contentEl()],
  });

  createPreventScroll(isOpen);

  return (
    <Show when={isOpen()}>
      <div
        {...stylex.attrs(styles.overlay)}
        data-midori-component="CommandPaletteBackdrop"
        onClick={close}
        aria-hidden="true"
      />
      <div
        data-midori-component="CommandPalette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabindex={-1}
        {...stylex.attrs(styles.root, merged.style)}
        ref={setContentEl}
        {...rest}
      >
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="midori-command-palette-list"
          aria-activedescendant={selectable()[activeIndex()]?.id}
          placeholder={merged.placeholder}
          value={query()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          {...stylex.attrs(styles.input)}
        />
        <div id="midori-command-palette-list" role="listbox" {...stylex.attrs(styles.list)}>
          <Show
            when={filtered().length > 0}
            fallback={<p {...stylex.attrs(styles.empty)}>{merged.emptyMessage}</p>}
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
                    {...stylex.attrs(styles.item)}
                    onClick={() => choose(item)}
                    onMouseMove={() => {
                      const index = selectableIndex();
                      if (index >= 0) setActiveIndex(index);
                    }}
                  >
                    <span {...stylex.attrs(styles.itemLabel)}>{item.label}</span>
                    <Show when={item.hint}>
                      <span {...stylex.attrs(styles.itemHint)}>{item.hint}</span>
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
