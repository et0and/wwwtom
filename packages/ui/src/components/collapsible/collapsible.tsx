import type { JSX } from "@solidjs/web";
import { createContext, createSignal, Show, merge, omit, useContext } from "solid-js";
import { cn } from "../../utils/cn";

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

export type CollapsibleRootProps = {
  children?: JSX.Element;
  class?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function CollapsibleRoot(props: CollapsibleRootProps): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = createSignal(props.defaultOpen ?? false);
  const isOpen = (): boolean => props.open ?? uncontrolledOpen();
  const setOpen = (next: boolean): void => {
    if (props.open === undefined) setUncontrolledOpen(next);
    props.onOpenChange?.(next);
  };
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "open", "defaultOpen", "onOpenChange");
  const value: CollapsibleContextValue = {
    isOpen,
    toggle: () => setOpen(!isOpen()),
    setOpen,
  };
  return (
    <div data-tomui-component="Collapsible" class={merged.class} {...rest}>
      <CollapsibleContext value={value}>{merged.children}</CollapsibleContext>
    </div>
  );
}

export type CollapsibleTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  children?: JSX.Element;
  class?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent> | undefined;
};

function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "onClick");
  return (
    <button
      data-tomui-component="Collapsible"
      data-tomui-part="trigger"
      type="button"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      class={cn("cursor-pointer", merged.class)}
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

export type CollapsiblePanelProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element;
  class?: string;
  keepMounted?: boolean;
};

function CollapsiblePanel(props: CollapsiblePanelProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class", "keepMounted");
  return (
    <Show when={merged.keepMounted === true || ctx.isOpen()}>
      <div
        data-tomui-component="Collapsible"
        data-tomui-part="panel"
        hidden={merged.keepMounted === true && !ctx.isOpen()}
        class={merged.class}
        {...rest}
      >
        {merged.children}
      </div>
    </Show>
  );
}

export type CollapsibleDefaultTriggerProps = {
  children?: JSX.Element;
  class?: string;
};

function CollapsibleDefaultTrigger(props: CollapsibleDefaultTriggerProps): JSX.Element {
  const ctx = useContext(CollapsibleContext);
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <button
      data-tomui-component="Collapsible"
      data-tomui-part="default-trigger"
      data-panel-open={ctx.isOpen() ? "" : undefined}
      type="button"
      aria-expanded={ctx.isOpen() ? "true" : "false"}
      class={cn(
        "m-0 flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-base font-medium text-tomui-default select-none",
        merged.class,
      )}
      onClick={() => ctx.toggle()}
      {...rest}
    >
      <span>{merged.children}</span>
      <span class="inline-grid w-4 shrink-0 place-items-center">
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          class={cn(
            "block size-3 origin-center transition-transform duration-100 ease-out",
            ctx.isOpen() && "rotate-180",
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
  const rest = omit(merged, "children", "class");
  return (
    <Show when={ctx.isOpen()}>
      <div class={cn("overflow-hidden", merged.class)} {...rest}>
        <div class="my-2 space-y-4 border-l-2 border-tomui-fill py-1 pr-1 pl-4">
          {merged.children}
        </div>
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
