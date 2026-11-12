import { textColors } from "../../styles/colors.stylex";
import type { JSX } from "@solidjs/web";
import {
  createContext,
  createSignal,
  createUniqueId,
  merge,
  onSettled,
  Show,
  useContext,
} from "solid-js";
import * as stylex from "@stylexjs/stylex";
import {
  fontSize2xs,
  fontSizeSm,
  fontSizeXs,
  fontWeightControl,
} from "../../styles/typography.stylex";
import { Label } from "../label/label";

export function normalizeFieldError(
  error: string | { message: JSX.Element; match: FieldErrorMatch } | undefined,
): { message: JSX.Element; match: FieldErrorMatch } | undefined {
  if (error === undefined || error === "") return undefined;
  if ((error as { message: JSX.Element }).message !== undefined)
    return error as { message: JSX.Element; match: FieldErrorMatch };
  return { message: error as string, match: true };
}

type FieldContextValue = {
  controlId: string;
  labelId: string;
  invalid: () => boolean;
};

const FieldContext = createContext<FieldContextValue>({
  controlId: "",
  labelId: "",
  invalid: () => false,
});

const styles = stylex.create({
  root: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.5rem",
    // A checkbox or switch inside collapses to a two-column row.
    ":has(input[type=checkbox])": {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      alignItems: "center",
    },
    ":has([role=switch])": {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      alignItems: "center",
    },
  },
  // controlFirst reverses the row so the control sits before the label.
  controlFirst: {
    ":has(input[type=checkbox])": {
      display: "flex",
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      alignItems: "center",
    },
    ":has([role=switch])": {
      display: "flex",
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      alignItems: "center",
    },
    ":has(input[type=checkbox]) > label": { flexGrow: 1 },
    ":has([role=switch]) > label": { flexGrow: 1 },
  },
  label: {
    display: "inline-flex",
    minHeight: "1rem",
    margin: 0,
    alignItems: "center",
    alignSelf: "stretch",
    gap: "0.25rem",
    padding: 0,
    borderWidth: 0,
    fontSize: fontSizeSm.fontSize,
    fontWeight: fontWeightControl.fontWeight,
    lineHeight: "1rem",
    color: textColors["--text-color-midori-default"],
    cursor: "default",
    userSelect: "none",
  },
  message: {
    gridColumn: "1 / -1",
    margin: 0,
    fontSize: fontSizeXs.fontSize,
    lineHeight: 1.375,
  },
  description: { color: textColors["--text-color-midori-subtle"] },
  error: { color: textColors["--text-color-midori-danger"] },
  prefix: {
    alignSelf: "stretch",
    width: "100%",
    minHeight: "0.6875rem",
    fontSize: fontSize2xs.fontSize,
    fontWeight: 440,
    lineHeight: 1,
    color: textColors["--text-color-midori-subtle"],
    userSelect: "none",
  },
  control: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
  },
});

export interface MidoriFieldVariantsProps {
  controlFirst?: boolean | undefined;
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
  invalid?: boolean | undefined;
  /** Associates the label with its control. Caller-supplied ids win; auto-generated otherwise. */
  controlId?: string | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function FieldRoot(props: FieldProps): JSX.Element {
  const merged = merge({ controlFirst: false, hideLabel: false, invalid: false }, props);
  const generatedId = createUniqueId();
  const controlId = (): string => merged.controlId ?? generatedId;
  const labelId = `field-label-${createUniqueId()}`;
  const normalized = (): { message: JSX.Element; match: FieldErrorMatch } | undefined =>
    normalizeFieldError(merged.error);

  const [rootElement, setRootElement] = createSignal<HTMLDivElement>();

  const syncControlA11y = (): void => {
    const control = rootElement()?.querySelector<HTMLElement>(
      "input, textarea, select, [role=switch]",
    );
    if (!control) return;
    if (!control.id) control.id = controlId();
    const hasLabel =
      Boolean(merged.label) || Boolean(rootElement()?.querySelector("[data-slot=field-label]"));
    if (hasLabel && !control.hasAttribute("aria-labelledby")) {
      control.setAttribute("aria-labelledby", labelId);
    }
    if (merged.invalid) {
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("data-invalid", "");
    }
  };

  onSettled(() => {
    syncControlA11y();
  });

  const contextValue: FieldContextValue = {
    controlId: controlId(),
    labelId,
    invalid: () => Boolean(merged.invalid),
  };

  return (
    <FieldContext value={contextValue}>
      <div
        data-midori-component="Field"
        data-invalid={merged.invalid ? "" : undefined}
        ref={(element) => {
          setRootElement(element);
        }}
        {...stylex.attrs(
          styles.root,
          merged.controlFirst ? styles.controlFirst : undefined,
          merged.style,
        )}
      >
        <Show when={!merged.hideLabel && merged.label}>
          {(label) => (
            <label for={controlId()} id={labelId} {...stylex.attrs(styles.label)}>
              <Label
                showOptional={merged.required === false}
                tooltip={merged.labelTooltip}
                asContent
              >
                {label()}
              </Label>
            </label>
          )}
        </Show>
        {merged.children}
        <Show
          when={normalized()}
          fallback={
            <Show when={merged.description}>
              <p {...stylex.attrs(styles.message, styles.description)}>{merged.description}</p>
            </Show>
          }
        >
          {(error) => (
            <p role="alert" {...stylex.attrs(styles.message, styles.error)}>
              {error().message}
            </p>
          )}
        </Show>
      </div>
    </FieldContext>
  );
}

export type FieldLabelProps = {
  children?: JSX.Element;
  tooltip?: JSX.Element | undefined;
  required?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function FieldLabel(props: FieldLabelProps): JSX.Element {
  const field = useContext(FieldContext);
  return (
    <label
      for={field.controlId}
      id={field.labelId}
      data-slot="field-label"
      {...stylex.attrs(styles.label, props.style)}
    >
      <Label showOptional={props.required === false} tooltip={props.tooltip} asContent>
        {props.children}
      </Label>
    </label>
  );
}

export type FieldSectionProps = {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function FieldPrefix(props: FieldSectionProps): JSX.Element {
  return (
    <div data-slot="field-prefix" {...stylex.attrs(styles.prefix, props.style)}>
      {props.children}
    </div>
  );
}

function FieldSuffix(props: FieldSectionProps): JSX.Element {
  return (
    <div data-slot="field-suffix" {...stylex.attrs(styles.prefix, props.style)}>
      {props.children}
    </div>
  );
}

function FieldControl(props: FieldSectionProps): JSX.Element {
  return (
    <div data-slot="field-control" {...stylex.attrs(styles.control, props.style)}>
      {props.children}
    </div>
  );
}

type FieldComponent = typeof FieldRoot & {
  Label: typeof FieldLabel;
  Prefix: typeof FieldPrefix;
  Suffix: typeof FieldSuffix;
  Control: typeof FieldControl;
};

export const Field: FieldComponent = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Prefix: FieldPrefix,
  Suffix: FieldSuffix,
  Control: FieldControl,
});
