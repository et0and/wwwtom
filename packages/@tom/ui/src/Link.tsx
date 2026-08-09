import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

type LinkProps = {
  href: string;
  children: JSX.Element;
  class?: string;
  preload?: boolean;
  onClick?: () => void;
};

export function Link(props: LinkProps) {
  return (
    <A
      href={props.href}
      class={props.class}
      preload={props.preload ?? true}
      onClick={props.onClick}
    >
      {props.children}
    </A>
  );
}
