import type { JSX } from "@solidjs/web";
import { merge, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { Label } from "../label/label";

export function normalizeFieldError(
  error: string | { message: JSX.Element; match: FieldErrorMatch } | undefined,
): { message: JSX.Element; match: FieldErrorMatch } | undefined {
  if (error === undefined || error === "") return undefined;
  if ((error as { message: JSX.Element }).message !== undefined)
    return error as { message: JSX.Element; match: FieldErrorMatch };
  return { message: error as string, match: true };
}

export interface TomuiFieldVariantsProps {
  controlFirst?: boolean | undefined;
}

export function fieldVariants(props: TomuiFieldVariantsProps = {}): string {
  const merged = merge({ controlFirst: false }, props);
  return cn(
    "grid gap-2",
    "has-[input[type=checkbox]]:grid-cols-[auto_1fr] has-[input[type=checkbox]]:items-center",
    "has-[[role=switch]]:grid-cols-[auto_1fr] has-[[role=switch]]:items-center",
    merged.controlFirst
      ? "has-[input[type=checkbox]]:flex has-[input[type=checkbox]]:flex-row-reverse has-[input[type=checkbox]]:flex-wrap has-[input[type=checkbox]]:items-center has-[[role=switch]]:flex has-[[role=switch]]:flex-row-reverse has-[[role=switch]]:flex-wrap has-[[role=switch]]:items-center [&>label]:flex-1"
      : "",
  );
}

export type FieldErrorMatch =
  | boolean
  | "badInput"
  | "customError"
  | "patternMismatch"
  | "rangeOverflow"
  | "rangeUnderflow"
  | "stepMismatch"
  | "tooLong"
  | "tooShort"
  | "typeMismatch"
  | "valid"
  | "valueMissing";

export type FieldProps = {
  children?: JSX.Element | undefined;
  label?: JSX.Element | undefined;
  required?: boolean | undefined;
  labelTooltip?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  description?: JSX.Element | undefined;
  controlFirst?: boolean | undefined;
  hideLabel?: boolean | undefined;
  class?: string | undefined;
};

export function Field(props: FieldProps): JSX.Element {
  const merged = merge({ controlFirst: false, hideLabel: false }, props);
  const normalized = (): { message: JSX.Element; match: FieldErrorMatch } | undefined =>
    normalizeFieldError(merged.error);
  return (
    <div
      data-tomui-component="Field"
      class={cn(fieldVariants({ controlFirst: merged.controlFirst }), merged.class)}
    >
      <Show when={!merged.hideLabel}>
        <label class="m-0 text-base font-medium text-tomui-default select-none">
          <Label showOptional={merged.required === false} tooltip={merged.labelTooltip} asContent>
            {merged.label}
          </Label>
        </label>
      </Show>
      {merged.children}
      <Show
        when={normalized()}
        fallback={
          <Show when={merged.description}>
            <p class="text-sm leading-snug text-tomui-subtle col-span-full">{merged.description}</p>
          </Show>
        }
      >
        {(error) => (
          <p role="alert" class="text-sm leading-snug text-tomui-danger col-span-full">
            {error().message}
          </p>
        )}
      </Show>
    </div>
  );
}
