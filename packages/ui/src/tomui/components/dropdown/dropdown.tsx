import type { JSX } from "@solidjs/web";
import { createContext, createSignal, merge, onSettled, Show, omit, useContext } from "solid-js";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_DROPDOWN_VARIANTS = {
  variant: {
    default: {
      classes: "",
      description: "Default dropdown item appearance",
    },
    danger: {
      classes:
        "text-tomui-danger data-highlighted:bg-tomui-danger/5 data-highlighted:text-tomui-danger",
      description: "Destructive action item",
    },
  },
} as const;

export const TOMUI_DROPDOWN_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiDropdownVariant = keyof typeof TOMUI_DROPDOWN_VARIANTS.variant;

export interface TomuiDropdownVariantsProps {
  variant?: TomuiDropdownVariant;
}

export function dropdownVariants(props: TomuiDropdownVariantsProps = {}): string {
  const merged = merge({ variant: TOMUI_DROPDOWN_DEFAULT_VARIANTS.variant }, props);
  return cn(
    resolveVariant(
      TOMUI_DROPDOWN_VARIANTS.variant,
      merged.variant,
      TOMUI_DROPDOWN_DEFAULT_VARIANTS.variant,
    ).classes,
  );
}

interface DropdownContextValue {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DropdownContext = createContext<DropdownContextValue>({
  isOpen: () => false,
  open: () => undefined,
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
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen()),
  };
  return (
    <div data-tomui-component="DropdownMenu" class="relative inline-block">
      <DropdownContext value={value}>{props.children}</DropdownContext>
    </div>
  );
}

export type DropdownMenuTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

function DropdownMenuTrigger(props: DropdownMenuTriggerProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="trigger"
      aria-haspopup="menu"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      class={merged.class}
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

export type DropdownMenuContentProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
  sideOffset?: number;
  /** Horizontal edge the menu aligns to. Use end for right-edge triggers. */
  align?: "start" | "end" | undefined;
};

function DropdownMenuContent(props: DropdownMenuContentProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({ align: "start" as const }, props);
  const rest = omit(merged, "children", "class", "align");
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
        class={cn(
          "absolute z-50 max-w-[calc(100vw-2rem)] min-w-36 overflow-hidden rounded-lg bg-tomui-control p-1.5 text-tomui-default shadow-lg ring ring-tomui-line",
          "top-full mt-2",
          merged.align === "end" ? "right-0" : "left-0",
          merged.class,
        )}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type DropdownMenuItemProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  inset?: boolean;
  selected?: boolean;
  href?: string;
  variant?: TomuiDropdownVariant;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

function DropdownMenuItem(props: DropdownMenuItemProps): JSX.Element {
  const ctx = useContext(DropdownContext);
  const merged = merge({ variant: TOMUI_DROPDOWN_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(
    merged,
    "children",
    "class",
    "icon",
    "inset",
    "selected",
    "href",
    "variant",
    "onClick",
    "disabled",
  );
  const itemClass = (): string =>
    cn(
      "relative flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-base outline-hidden select-none focus:text-tomui-default data-disabled:pointer-events-none data-disabled:opacity-50",
      merged.inset && "pl-8",
      dropdownVariants({ variant: merged.variant }),
      merged.class,
    );
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
          class={cn(itemClass(), "text-inherit no-underline")}
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
        class={itemClass()}
        onClick={handleClick}
        {...rest}
      >
        {merged.icon}
        {merged.children}
        <Show when={merged.selected}>
          <span class="ml-auto inline-flex">{"✓"}</span>
        </Show>
      </button>
    </Show>
  );
}

export type DropdownMenuLinkItemProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  inset?: boolean;
  variant?: TomuiDropdownVariant;
};

function DropdownMenuLinkItem(props: DropdownMenuLinkItemProps): JSX.Element {
  const merged = merge({ variant: TOMUI_DROPDOWN_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "class", "icon", "inset", "variant");
  return (
    <a
      data-tomui-component="DropdownMenu"
      data-tomui-part="link-item"
      role="menuitem"
      class={cn(
        "relative flex cursor-default items-center rounded-md px-2 py-1.5 text-base outline-hidden select-none",
        "text-inherit no-underline",
        merged.inset && "pl-8",
        dropdownVariants({ variant: merged.variant }),
        merged.class,
      )}
      {...rest}
    >
      {merged.icon}
      {merged.children}
    </a>
  );
}

export type DropdownMenuCheckboxItemProps = {
  children?: JSX.Element;
  class?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
};

function DropdownMenuCheckboxItem(props: DropdownMenuCheckboxItemProps): JSX.Element {
  const [uncontrolled, setUncontrolled] = createSignal(props.defaultChecked ?? false);
  const isChecked = (): boolean => props.checked ?? uncontrolled();
  const merged = merge({}, props);
  const rest = omit(
    merged,
    "children",
    "class",
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
      class={cn(
        "relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-base outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        merged.class,
      )}
      onClick={() => {
        const next = !isChecked();
        if (props.checked === undefined) setUncontrolled(next);
        props.onCheckedChange?.(next);
      }}
      {...rest}
    >
      <Show when={isChecked()}>
        <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">{"✓"}</span>
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

export type DropdownMenuRadioItemProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: JSX.Element;
  class?: string;
  value: string;
};

function DropdownMenuRadioItem(props: DropdownMenuRadioItemProps): JSX.Element {
  const group = useContext(RadioGroupContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "value");
  const isChecked = (): boolean => group.value() === merged.value;
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="radio-item"
      role="menuitemradio"
      aria-checked={isChecked() ? "true" : "false"}
      class={cn(
        "relative flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-base outline-hidden select-none",
        merged.class,
      )}
      onClick={() => group.select(merged.value)}
      {...rest}
    >
      {merged.children}
      <Show when={isChecked()}>
        <span class="ml-auto">{"✓"}</span>
      </Show>
    </button>
  );
}

export type DropdownMenuLabelProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
  inset?: boolean;
};

function DropdownMenuLabel(props: DropdownMenuLabelProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "inset");
  return (
    <div
      class={cn("px-2 py-1.5 text-base font-semibold", merged.inset && "pl-8", merged.class)}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export type DropdownMenuSeparatorProps = JSX.HTMLAttributes<HTMLHRElement> & {
  class?: string;
};

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "class");
  return <hr class={cn("-mx-1 my-1 h-px bg-tomui-hairline border-0", merged.class)} {...rest} />;
}

export type DropdownMenuShortcutProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  children?: JSX.Element;
  class?: string;
};

function DropdownMenuShortcut(props: DropdownMenuShortcutProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <span class={cn("ml-auto text-xs tracking-widest opacity-60", merged.class)} {...rest}>
      {merged.children}
    </span>
  );
}

export type DropdownMenuSubProps = {
  children?: JSX.Element;
};

function DropdownMenuSub(props: DropdownMenuSubProps): JSX.Element {
  return <div class="relative">{props.children}</div>;
}

export type DropdownMenuSubTriggerProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: JSX.Element;
  class?: string;
  icon?: JSX.Element;
  inset?: boolean;
};

function DropdownMenuSubTrigger(props: DropdownMenuSubTriggerProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "icon", "inset");
  return (
    <button
      data-tomui-component="DropdownMenu"
      data-tomui-part="submenu-trigger"
      class={cn(
        "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-base outline-hidden select-none",
        merged.inset && "pl-8",
        merged.class,
      )}
      {...rest}
    >
      {merged.icon}
      {merged.children}
      <span class="ml-auto">{"›"}</span>
    </button>
  );
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  SubContent: DropdownMenuContent,
  Item: DropdownMenuItem,
  LinkItem: DropdownMenuLinkItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  Group: DropdownMenuSub,
});
