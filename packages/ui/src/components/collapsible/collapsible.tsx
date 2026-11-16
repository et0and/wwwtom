import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createContext, merge, omit, Show, useContext } from "solid-js";
import { colors, textColors } from "../../styles/colors.stylex";
import { fontSizeSm, fontWeightControl } from "../../styles/typography.stylex";
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
    display: "flex",
    width: "100%",
    height: "2rem",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    borderWidth: "0.5px",
    borderStyle: "solid",
    borderColor: colors["--color-midori-line"],
    borderRadius: "0.5rem",
    backgroundColor: colors["--color-midori-base"],
    paddingInline: "0.75rem",
    paddingBlock: "0.5rem",
    cursor: "pointer",
    fontSize: fontSizeSm.fontSize,
    fontWeight: fontWeightControl.fontWeight,
    lineHeight: "16px",
    color: textColors["--text-color-midori-default"],
    userSelect: "none",
    ":hover": { backgroundColor: colors["--color-midori-overlay-hover"] },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: colors["--color-midori-focus"],
      outlineOffset: "1px",
    },
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
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    borderWidth: "0.5px",
    borderStyle: "solid",
    borderColor: colors["--color-midori-line"],
    borderTopWidth: 0,
    borderBottomLeftRadius: "0.5rem",
    borderBottomRightRadius: "0.5rem",
    backgroundColor: colors["--color-midori-layer-01"],
    padding: "0.75rem",
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
    <div data-midori-component="Collapsible" {...stylex.attrs(merged.style)} {...rest}>
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
      data-midori-component="Collapsible"
      data-midori-part="trigger"
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
        data-midori-component="Collapsible"
        data-midori-part="panel"
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
      data-midori-component="Collapsible"
      data-midori-part="default-trigger"
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
