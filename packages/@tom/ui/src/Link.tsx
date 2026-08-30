import type { JSX } from "@solidjs/web";

type LinkProps = {
  href: string;
  children: JSX.Element;
  class?: string;
  preload?: boolean;
  onClick?: () => void;
};

export function Link(props: LinkProps) {
  return (
    <a
      href={props.href}
      class={props.class}
      preload={props.preload === false ? "false" : undefined}
      onClick={props.onClick}
    >
      {props.children}
    </a>
  );
}
