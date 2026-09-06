import { For, merge, omit, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

// Simplified port: Tomui's descendants-tracking + measured layout replaced by DOM-order vertical stack with SVG lines via ResizeObserver.

export const TOMUI_FLOW_VARIANTS = {
  orientation: {
    horizontal: { classes: "flex-row", description: "Nodes progress left-to-right" },
    vertical: { classes: "flex-col", description: "Nodes progress top-to-bottom" },
  },
  align: {
    start: { classes: "items-start", description: "Nodes align to the start edge" },
    center: { classes: "items-center", description: "Nodes centered across the inactive axis" },
  },
} as const;

export const TOMUI_FLOW_DEFAULT_VARIANTS = {
  align: "start",
  orientation: "vertical",
} as const;

export type TomuiFlowOrientation = keyof typeof TOMUI_FLOW_VARIANTS.orientation;
export type TomuiFlowAlign = keyof typeof TOMUI_FLOW_VARIANTS.align;

export type FlowProps = JSX.HTMLAttributes<HTMLDivElement> & {
  align?: TomuiFlowAlign;
  children?: JSX.Element;
  class?: string;
  orientation?: TomuiFlowOrientation;
};

export type FlowNodeProps = JSX.HTMLAttributes<HTMLLIElement> & {
  children?: JSX.Element;
  class?: string;
  disabled?: boolean;
  nodeId?: string;
};

export type FlowParallelProps = JSX.HTMLAttributes<HTMLLIElement> & {
  align?: "end";
  children?: JSX.Element;
  class?: string;
};

interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface FlowElementRef {
  current?: HTMLDivElement | undefined;
}

interface FlowListRef {
  current?: HTMLUListElement | undefined;
}

function connectorPath(line: ConnectorLine): string {
  const midY = (line.y1 + line.y2) / 2;
  return `M ${line.x1} ${line.y1} L ${line.x1} ${midY} L ${line.x2} ${midY} L ${line.x2} ${line.y2}`;
}

export function flowVariants(
  props: { orientation?: TomuiFlowOrientation; align?: TomuiFlowAlign } = {},
): string {
  const merged = merge(TOMUI_FLOW_DEFAULT_VARIANTS, props);
  return cn(
    "tomui-flow relative flex gap-6",
    resolveVariant(
      TOMUI_FLOW_VARIANTS.orientation,
      merged.orientation,
      TOMUI_FLOW_DEFAULT_VARIANTS.orientation,
    ).classes,
    resolveVariant(TOMUI_FLOW_VARIANTS.align, merged.align, TOMUI_FLOW_DEFAULT_VARIANTS.align)
      .classes,
  );
}

export function FlowNode(props: FlowNodeProps) {
  const merged = merge({ disabled: false }, props);
  const rest = omit(merged, "children", "class", "disabled", "nodeId");
  return (
    <li
      data-tomui-component="FlowNode"
      data-flow-node={merged.nodeId ?? ""}
      data-disabled={merged.disabled || undefined}
      class={cn(
        "tomui-flow-node relative rounded-md bg-tomui-base px-3 py-2 shadow ring ring-tomui-line",
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </li>
  );
}

export function FlowParallel(props: FlowParallelProps) {
  const rest = omit(props, "align", "children", "class");
  return (
    <li
      data-tomui-component="FlowParallel"
      data-flow-parallel={props.align ?? ""}
      class={cn("tomui-flow-parallel flex gap-4", props.class)}
      {...rest}
    >
      {props.children}
    </li>
  );
}

export function Flow(props: FlowProps) {
  const merged = merge(
    {
      align: TOMUI_FLOW_DEFAULT_VARIANTS.align,
      orientation: TOMUI_FLOW_DEFAULT_VARIANTS.orientation,
    },
    props,
  );
  const rest = omit(merged, "align", "children", "class", "orientation");
  const rootRef: FlowElementRef = { current: undefined };
  const listRef: FlowListRef = { current: undefined };
  const itemEls: Array<HTMLElement> = [];
  const lines = (): Array<ConnectorLine> => {
    const root = rootRef.current;
    const items = itemEls;
    if (!root || items.length < 2) return [];
    const rootRect = root.getBoundingClientRect();
    const centers = items.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - rootRect.left + rect.width / 2,
        y: rect.top - rootRect.top + rect.height / 2,
        bottom: rect.top - rootRect.top + rect.height,
      };
    });
    return centers.slice(1).map((point, index) => {
      const prev = centers[index];
      const current = centers[index + 1] ?? point;
      const from = prev ?? { x: 0, y: 0, bottom: 0 };
      return { x1: from.x, y1: from.bottom, x2: current.x, y2: current.y };
    });
  };
  const setRoot = (el: HTMLDivElement) => {
    rootRef.current = el;
  };
  onSettled(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!root || !list) return;
    const collect = () => {
      itemEls.length = 0;
      const nodes = list.querySelectorAll("[data-flow-node]");
      nodes.forEach((node) => {
        if (node instanceof HTMLElement) itemEls.push(node);
      });
    };
    collect();
    const listObserver = new ResizeObserver(collect);
    listObserver.observe(list);
    const rootObserver = new ResizeObserver(() => {
      root.dispatchEvent(new CustomEvent("tomui-flow-resize"));
    });
    rootObserver.observe(root);
    return () => {
      listObserver.disconnect();
      rootObserver.disconnect();
      itemEls.length = 0;
      rootRef.current = undefined;
      listRef.current = undefined;
    };
  });
  return (
    <div
      ref={setRoot}
      data-tomui-component="Flow"
      data-orientation={merged.orientation}
      class={cn(
        flowVariants({ align: merged.align, orientation: merged.orientation }),
        merged.class,
      )}
      {...rest}
    >
      <ul
        ref={(el: HTMLUListElement) => {
          listRef.current = el;
        }}
        class={cn(
          "tomui-flow-list m-0 flex list-none flex-col gap-6 p-0",
          merged.orientation === "horizontal" && "flex-row",
        )}
      >
        {merged.children}
      </ul>
      <svg
        class="tomui-flow-connectors pointer-events-none absolute inset-0 h-full w-full overflow-visible text-tomui-placeholder"
        aria-hidden="true"
      >
        <For each={lines()}>
          {(line: ConnectorLine) => (
            <path d={connectorPath(line)} fill="none" stroke="currentColor" stroke-width="2" />
          )}
        </For>
      </svg>
    </div>
  );
}
