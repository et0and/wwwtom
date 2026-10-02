import type { JSX } from "@solidjs/web";
import { createContext, createSignal, merge, onSettled, Show, omit, useContext } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { CheckIcon } from "@tom/icons/Check";
import { colors } from "../../styles/colors.stylex";
import { menuItem, radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

export const TOMUI_DROPDOWN_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiDropdownVariant = "default" | "danger";

const styles = stylex.create({
  root: { position: "relative", display: "inline-block" },
  content: {
    position: "absolute",
    zIndex: 50,
    maxWidth: "calc(100vw - 2rem)",
    minWidth: "9rem",
    maxHeight: "var(--available-height)",
    overflowY: "auto",
    overflowX: "hidden",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-control"],
    padding: "0.375rem",
    color: textColors["--text-color-tomui-default"],
    boxShadow: "0 0 0 1px " + colors["--color-tomui-line"] + ", 0 10px 15px -3px rgb(0 0 0 / 0.1)",
    top: "100%",
    marginTop: "0.5rem",
  },
  alignStart: { right: "auto", left: 0 },
  alignEnd: { right: 0, left: "auto" },
  /** Link items must not inherit link styling from the document. */
  link: { width: "100%", color: "inherit", textDecorationLine: "none" },
});

const variantStyles = {
  default: menuItem.plain,
  danger: menuItem.danger,
} as const satisfies Record<TomuiDropdownVariant, stylex.StyleXStyles>;

interface DropdownContextValue {
  isOpen: () => boolean;
  close: () => void;
  toggle: () => void;
}

const DropdownContext = createContext<DropdownContextValue>({
  isOpen: () => false,
  close: () => undefined,
  toggle: () => undefined,
});

export type DropdownMenuRootProps = {
  children?: JSX.Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function DropdownMenuRoot(props: DropdownMenuRootProps): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(props.defaultOpen ?? false);
  const isOpen = (): boolean => props.open ?? uncontrolledOpen();
  const setOpen = (next: boolean): void => {
    if (props.open === undefined) setUncontrolledOpen(next);
    props.onOpenChange?.(next);
  };
  const value: DropdownContextValue = {
    isOpen,
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen()),
  };
  return (
    <div data-tomui-component="DropdownMenu" {...stylex.attrs(styles.root)}>
      <DropdownContext value={value}>{props.children}</DropdownContext>
    </div>
  );
}

export type DropdownMenuTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  children?: JSX.Element;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuTrigger(props: DropdownMenuTriggerProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "onClick", "style");
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="trigger"
      aria-haspopup="menu"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
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

export type DropdownMenuContentProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  /** Horizontal edge the menu aligns to. Use end for right-edge triggers. */
  align?: "start" | "end" | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuContent(props: DropdownMenuContentProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({ align: "start" as const }, props);
  const rest = omit(merged, "children", "style", "align");
  let element: HTMLDivElement | undefined;
  onSettled(() => {
    const onOutside = (event: MouseEvent): void => {
      if (element && !element.contains(event.target as Node)) ctx.close();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") ctx.close();
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  });
  return (
    <Show when={ctx.isOpen()}>
      <div
        {...rest}
        ref={(el) => {
          element = el;
        }}
        data-tomui-component="DropdownMenu"
        data-tomui-part="content"
        role="menu"
        {...stylex.attrs(
          styles.content,
          merged.align === "end" ? styles.alignEnd : styles.alignStart,
          merged.style,
        )}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type DropdownMenuItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "style"
> & {
  children?: JSX.Element;
  icon?: JSX.Element;
  inset?: boolean;
  selected?: boolean;
  href?: string;
  variant?: TomuiDropdownVariant;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuItem(props: DropdownMenuItemProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({ variant: TOMUI_DROPDOWN_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(
    merged,
    "children",
    "icon",
    "inset",
    "selected",
    "href",
    "variant",
    "onClick",
    "disabled",
    "style",
  );
  const itemStyles = () => [
    menuItem.base,
    menuItem.rounded,
    menuItem.vertical,
    merged.inset ? menuItem.checkable : menuItem.plain,
    variantStyles[merged.variant],
    merged.style,
  ];
  const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    ctx.close();
    merged.onClick?.(event);
  };
  return (
    <Show
      when={merged.href === undefined}
      fallback={
        <a
          data-tomui-component="DropdownMenu"
          data-tomui-part="item"
          role="menuitem"
          href={merged.href}
          {...stylex.attrs(...itemStyles(), styles.link)}
        >
          {merged.icon}
          {merged.children}
        </a>
      }
    >
      <button
        data-tomui-component="DropdownMenu"
        data-tomui-part="item"
        role="menuitem"
        disabled={merged.disabled}
        {...stylex.attrs(...itemStyles())}
        onClick={handleClick}
        {...rest}
      >
        {merged.icon}
        {merged.children}
        <Show when={merged.selected}>
          <span {...stylex.attrs(menuItem.trailing)}>
            <CheckIcon size="sm" color="current" />
          </span>
        </Show>
      </button>
    </Show>
  );
}

export type DropdownMenuCheckboxItemProps = {
  children?: JSX.Element;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuCheckboxItem(props: DropdownMenuCheckboxItemProps): JSX.Element {
  const [uncontrolled, setUncontrolled] = createSignal(props.defaultChecked ?? false);
  const isChecked = (): boolean => props.checked ?? uncontrolled();
  const merged = merge({}, props);
  const rest = omit(
    merged,
    "children",
    "style",
    "checked",
    "defaultChecked",
    "onCheckedChange",
    "disabled",
  );
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="checkbox-item"
      role="menuitemcheckbox"
      aria-checked={isChecked() ? "true" : "false"}
      disabled={merged.disabled}
      {...stylex.attrs(
        menuItem.base,
        menuItem.rounded,
        menuItem.vertical,
        menuItem.checkable,
        merged.style,
      )}
      onClick={() => {
        const next = !isChecked();
        if (props.checked === undefined) setUncontrolled(next);
        props.onCheckedChange?.(next);
      }}
      {...rest}
    >
      <Show when={isChecked()}>
        <span {...stylex.attrs(menuItem.checkColumn)}>
          <CheckIcon size="xs" color="current" />
        </span>
      </Show>
      {merged.children}
    </button>
  );
}

export type DropdownMenuRadioGroupProps = {
  children?: JSX.Element;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const RadioGroupContext = createContext<{
  value: () => string | undefined;
  select: (value: string) => void;
}>({
  value: () => undefined,
  select: () => undefined,
});

function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps): JSX.Element {
  const [uncontrolled, setUncontrolled] = createSignal(props.defaultValue);
  const value = (): string | undefined => props.value ?? uncontrolled();
  const select = (next: string): void => {
    if (props.value === undefined) setUncontrolled(next);
    props.onValueChange?.(next);
  };
  return (
    <RadioGroupContext value={{ value, select }}>
      <div role="group">{props.children}</div>
    </RadioGroupContext>
  );
}

export type DropdownMenuRadioItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "style"
> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  value: string;
};

function DropdownMenuRadioItem(props: DropdownMenuRadioItemProps): JSX.Element {
  const group = useContext(RadioGroupContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style", "value");
  const isChecked = (): boolean => group.value() === merged.value;
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="radio-item"
      role="menuitemradio"
      aria-checked={isChecked() ? "true" : "false"}
      {...stylex.attrs(
        menuItem.base,
        menuItem.rounded,
        menuItem.vertical,
        menuItem.plain,
        merged.style,
      )}
      onClick={() => group.select(merged.value)}
      {...rest}
    >
      {merged.children}
      <Show when={isChecked()}>
        <span {...stylex.attrs(menuItem.trailing)}>
          <CheckIcon size="sm" color="current" />
        </span>
      </Show>
    </button>
  );
}

export type DropdownMenuLabelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  inset?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuLabel(props: DropdownMenuLabelProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style", "inset");
  return (
    <div
      {...stylex.attrs(
        menuItem.label,
        merged.inset ? menuItem.labelInset : undefined,
        merged.style,
      )}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export type DropdownMenuSeparatorProps = Omit<JSX.HTMLAttributes<HTMLHRElement>, "style"> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "style");
  return <hr {...stylex.attrs(menuItem.separator, merged.style)} {...rest} />;
}

export type DropdownMenuShortcutProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function DropdownMenuShortcut(props: DropdownMenuShortcutProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <span {...stylex.attrs(menuItem.shortcut, merged.style)} {...rest}>
      {merged.children}
    </span>
  );
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
});
