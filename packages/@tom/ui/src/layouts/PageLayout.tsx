import type { Component, JSX, Accessor } from "solid-js";
import { createMemo } from "solid-js";
import { Metadata } from "./Meta";

interface PageLayoutProps {
  children: JSX.Element;
  title?: string | Accessor<string>;
  description?: string | Accessor<string>;
  canonical?: string | Accessor<string>;
  frontmatter?: {
    title: string;
    summary: string;
    publishedAt: string;
  };
  jsonLd?: Record<string, unknown>;
  class?: string;
}

export const PageLayout: Component<PageLayoutProps> = (props) => {
  const title = createMemo(
    () =>
      props.frontmatter?.title ??
      (typeof props.title === "function" ? props.title() : props.title) ??
      "",
  );
  const description = createMemo(
    () =>
      props.frontmatter?.summary ??
      (typeof props.description === "function" ? props.description() : props.description) ??
      "",
  );
  const canonical = createMemo(() =>
    typeof props.canonical === "function" ? props.canonical() : props.canonical,
  );

  return (
    <div class={props.class}>
      <Metadata
        title={title()}
        metaType="description"
        metaContent={description()}
        {...(canonical() ? { canonical: canonical() } : {})}
      />
      {props.jsonLd && (
        <script type="application/ld+json" innerHTML={JSON.stringify(props.jsonLd)} />
      )}
      <main id="main" class="mx-auto p-8 max-w-[750px] view-transition-main">
        {props.children}
      </main>
    </div>
  );
};
