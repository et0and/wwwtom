import * as stylex from "@stylexjs/stylex";
import { For, merge, omit, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

// Simplified port: Tomui's descendants-tracking + measured layout replaced by DOM-order vertical stack with SVG lines via ResizeObserver.

const lineColor = colors["--color-tomui-line"];
const placeholder = textColors["--text-color-tomui-placeholder"];

const styles = stylex.create({
  root: { position: "relative", display: "flex", gap: "1.5rem" },
  orientationHorizontal: { flexDirection: "row" },
  orientationVertical: { flexDirection: "column" },
  alignStart: { alignItems: "flex-start" },
  alignCenter: { alignItems: "center" },
  node: {
    position: "relative",
    borderRadius: radius.md.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    paddingInline: "0.75rem",
    paddingBlock: "0.5rem",
    boxShadow:
      "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1), 0 0 0 1px " + lineColor,
  },
  parallel: { display: "flex", gap: "1rem" },
  list: {
    margin: 0,
    display: "flex",
    listStyle: "none",
    flexDirection: "column",
    gap: "1.5rem",
    padding: 0,
  },
  listHorizontal: { flexDirection: "row" },
  connectors: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    height: "100%",
    width: "100%",
    overflow: "visible",
    color: placeholder,
  },
});

export const TOMUI_FLOW_DEFAULT_VARIANTS = {
  align: "start",
  orientation: "vertical",
} as const;

export type TomuiFlowOrientation = "horizontal" | "vertical";
export type TomuiFlowAlign = "start" | "center";

export type FlowProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  align?: TomuiFlowAlign;
  children?: JSX.Element;
  orientation?: TomuiFlowOrientation;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type FlowNodeProps = Omit<JSX.HTMLAttributes<HTMLLIElement>, "style"> & {
  children?: JSX.Element;
  disabled?: boolean;
  nodeId?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type FlowParallelProps = Omit<JSX.HTMLAttributes<HTMLLIElement>, "style"> & {
  align?: "end";
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
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
): Array<stylex.StyleXStyles> {
  const merged = merge(TOMUI_FLOW_DEFAULT_VARIANTS, props);
  return [
    styles.root,
    merged.orientation === "horizontal" ? styles.orientationHorizontal : styles.orientationVertical,
    merged.align === "center" ? styles.alignCenter : styles.alignStart,
  ];
}

export function FlowNode(props: FlowNodeProps) {
  const merged = merge({ disabled: false }, props);
  const rest = omit(merged, "children", "style", "disabled", "nodeId");
  return (
    <li
      data-tomui-component="FlowNode"
      data-flow-node={merged.nodeId ?? ""}
      data-disabled={merged.disabled || undefined}
      {...stylex.attrs(styles.node, merged.style)}
      {...rest}
    >
      {merged.children}
    </li>
  );
}

export function FlowParallel(props: FlowParallelProps) {
  const rest = omit(props, "align", "children", "style");
  return (
    <li
      data-tomui-component="FlowParallel"
      data-flow-parallel={props.align ?? ""}
      {...stylex.attrs(styles.parallel, props.style)}
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
  const rest = omit(merged, "align", "children", "style", "orientation");
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
      {...stylex.attrs(
        ...flowVariants({ align: merged.align, orientation: merged.orientation }),
        merged.style,
      )}
      {...rest}
    >
      <ul
        ref={(el: HTMLUListElement) => {
          listRef.current = el;
        }}
        {...stylex.attrs(
          styles.list,
          merged.orientation === "horizontal" ? styles.listHorizontal : undefined,
        )}
      >
        {merged.children}
      </ul>
      <svg {...stylex.attrs(styles.connectors)} aria-hidden="true">
        <For each={lines()}>
          {(line: ConnectorLine) => (
            <path d={connectorPath(line)} fill="none" stroke="currentColor" stroke-width="2" />
          )}
        </For>
      </svg>
    </div>
  );
}
