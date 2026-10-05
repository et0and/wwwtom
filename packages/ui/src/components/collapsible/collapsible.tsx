import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createContext, merge, omit, Show, useContext } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { layout } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase } from "../../styles/typography.stylex";
import { createDisclosureState } from "../../utils/state";

interface CollapsibleContextValue {
  isOpen: () => boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue>({
  isOpen: () => false,
  toggle: () => undefined,
  setOpen: () => undefined,
});

const styles = stylex.create({
  trigger: { cursor: "pointer" },
  defaultTrigger: {
    margin: 0,
    borderStyle: "none",
    backgroundColor: "transparent",
    padding: 0,
    boxShadow: "none",
    display: "flex",
    cursor: "pointer",
    alignItems: "center",
    gap: layout.gap1.gap,
    fontSize: fontSizeBase.fontSize,
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
    userSelect: "none",
  },
  defaultTriggerIconWrap: {
    display: "inline-grid",
    width: "1rem",
    flexShrink: 0,
    placeItems: "center",
  },
  defaultTriggerIcon: {
    display: "block",
    width: "0.75rem",
    height: "0.75rem",
    transformOrigin: "center",
    transitionProperty: "transform",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-out",
  },
  defaultTriggerIconOpen: { transform: "rotate(180deg)" },
  /**
   * `--collapsible-panel-height` is never set anywhere, so `height` always
   * resolves to `auto`; `data-starting-style`/`data-ending-style` are also
   * never set on this element (only the dismissable-layer components set
   * them), so those two rules never match either. Kept so the transition
   * intent stays visible.
   */
  defaultPanelWrapper: {
    height: "var(--collapsible-panel-height)",
    overflow: "hidden",
    transitionProperty: "height, opacity",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-out",
    ":is([data-ending-style])": { height: 0, opacity: 0 },
    ":is([data-starting-style])": { height: 0, opacity: 0 },
    /**
     * The original Tailwind rule carved out `[hidden="until-found"]` so the
     * browser's native find-in-page expansion still works. StyleX has no
     * confirmed-safe way to chain `:is():not()` here, and this div never
     * receives a `hidden` attribute anyway (only `CollapsiblePanel` sets
     * one), so the carve-out is dropped. See migration report.
     */
    ":is([hidden])": { display: "none" },
  },
  defaultPanelInner: {
    marginBlock: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: layout.gap4.gap,
    borderLeftWidth: 2,
    borderLeftColor: colors["--color-tomui-fill"],
    paddingBlock: "0.25rem",
    paddingInlineEnd: "0.25rem",
    paddingInlineStart: "1rem",
  },
});

export type CollapsibleRootProps = {
  children?: JSX.Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function CollapsibleRoot(props: CollapsibleRootProps): JSX.Element {
  const state = createDisclosureState({
    open: () => props.open,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange,
  });
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style", "open", "defaultOpen", "onOpenChange");
  const value: CollapsibleContextValue = {
    isOpen: state.isOpen,
    toggle: state.toggle,
    setOpen: state.setIsOpen,
  };
  return (
    <div data-tomui-component="Collapsible" {...stylex.attrs(merged.style)} {...rest}>
      <CollapsibleContext value={value}>{merged.children}</CollapsibleContext>
    </div>
  );
}

export type CollapsibleTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "class" | "style"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="Collapsible"
      data-tomui-part="trigger"
      type="button"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      {...stylex.attrs(styles.trigger, merged.style)}
      onClick={(event) => {
        ctx.toggle();
        merged.onClick?.(event);
      }}
      {...rest}
    >
      {merged.children}
    </button>
  );
}

export type CollapsiblePanelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "style"> & {
  children?: JSX.Element;
  keepMounted?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function CollapsiblePanel(props: CollapsiblePanelProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "keepMounted", "style");
  return (
    <Show when={merged.keepMounted === true || ctx.isOpen()}>
      <div
        data-tomui-component="Collapsible"
        data-tomui-part="panel"
        hidden={merged.keepMounted === true && !ctx.isOpen()}
        {...stylex.attrs(merged.style)}
        {...rest}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type CollapsibleDefaultTriggerProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function CollapsibleDefaultTrigger(props: CollapsibleDefaultTriggerProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <button
      data-tomui-component="Collapsible"
      data-tomui-part="default-trigger"
      data-panel-open={ctx.isOpen() ? "" : undefined}
      type="button"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      {...stylex.attrs(styles.defaultTrigger, merged.style)}
      onClick={() => ctx.toggle()}
      {...rest}
    >
      <span>{merged.children}</span>
      <span {...stylex.attrs(styles.defaultTriggerIconWrap)}>
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          {...stylex.attrs(
            styles.defaultTriggerIcon,
            ctx.isOpen() ? styles.defaultTriggerIconOpen : undefined,
          )}
        >
          <path
            d="M3 5.5L8 10.5L13 5.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
      </span>
    </button>
  );
}

export type CollapsibleDefaultPanelProps = CollapsiblePanelProps;

function CollapsibleDefaultPanel(props: CollapsibleDefaultPanelProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <Show when={ctx.isOpen()}>
      <div {...stylex.attrs(styles.defaultPanelWrapper, merged.style)} {...rest}>
        <div {...stylex.attrs(styles.defaultPanelInner)}>{merged.children}</div>
      </div>
    </Show>
  );
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
  DefaultTrigger: CollapsibleDefaultTrigger,
  DefaultPanel: CollapsibleDefaultPanel,
});
