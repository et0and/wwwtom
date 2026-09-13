import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";

export interface TomuiLabelVariantsProps {}

export function labelVariants(_props: TomuiLabelVariantsProps = {}): string {
  return cn("m-0 text-base font-medium text-tomui-default");
}

export function labelContentVariants(): string {
  return cn("inline-flex items-center gap-1");
}

export type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement> & {
  children?: JSX.Element | undefined;
  showOptional?: boolean | undefined;
  tooltip?: JSX.Element | undefined;
  class?: string | undefined;
  htmlFor?: string | undefined;
  asContent?: boolean | undefined;
  icon?: JSX.Element | undefined;
};

export function Label(props: LabelProps): JSX.Element {
  const merged = merge({ showOptional: false, asContent: false }, props);
  const rest = omit(
    merged,
    "children",
    "showOptional",
    "tooltip",
    "class",
    "htmlFor",
    "asContent",
    "icon",
  );
  const content = (): JSX.Element => (
    <>
      {merged.children}
      <Show when={merged.showOptional}>
        <span class="font-normal text-tomui-subtle">(optional)</span>
      </Show>
      <Show when={merged.tooltip}>
        <span class="inline-flex items-center gap-1 text-tomui-subtle">
          <Show when={merged.icon} fallback={<span aria-hidden="true">{"ⓘ"}</span>}>
            {merged.icon}
          </Show>
          {merged.tooltip}
        </span>
      </Show>
    </>
  );
  return (
    <Show
      when={!merged.asContent}
      fallback={<span class={cn(labelContentVariants(), merged.class)}>{content()}</span>}
    >
      <label
        data-tomui-component="Label"
        {...rest}
        for={merged.htmlFor ?? rest.for}
        class={cn(labelVariants(), labelContentVariants(), merged.class)}
      >
        {content()}
      </label>
    </Show>
  );
}
