import { A } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import type { JSX } from "solid-js";
import { Spinner } from "./Spinner";

type LinkProps = {
  href: string;
  children: JSX.Element;
  class?: string;
  preload?: boolean;
  onClick?: () => void;
};

export function Link(props: LinkProps) {
  const [isLoading, setIsLoading] = createSignal(false);

  const handleClick = () => {
    setIsLoading(true);
    props.onClick?.();
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div class="flex items-center gap-1">
      <A
        href={props.href}
        class={props.class}
        preload={props.preload ?? true}
        onClick={handleClick}
      >
        {props.children}
      </A>
      <Show when={isLoading()}>
        <Spinner color="black" class="h-3 w-3" />
      </Show>
    </div>
  );
}
