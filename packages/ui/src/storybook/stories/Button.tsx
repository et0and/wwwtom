import { merge, omit } from "solid-js";
import "./button.css";

export interface ButtonProps {
  primary?: boolean;
  backgroundColor?: string;
  size?: "small" | "medium" | "large";
  label: string;
}

/** Primary UI component for user interaction */
export const Button = (_props: ButtonProps) => {
  const props = merge({ primary: false, backgroundColor: null, size: "medium" }, _props);
  const rest = omit(props, "primary", "backgroundColor", "size", "label");

  const mode = () => (props.primary ? "storybook-button--primary" : "storybook-button--secondary");

  return (
    <button
      type="button"
      class={["storybook-button", `storybook-button--${props.size}`, mode()].join(" ")}
      style={props.backgroundColor ? { "background-color": props.backgroundColor } : undefined}
      {...rest}
    >
      {props.label}
    </button>
  );
};
