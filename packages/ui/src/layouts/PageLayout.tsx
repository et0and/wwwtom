import type { Component, Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createMemo, untrack } from "solid-js";
import type { JsonLd } from "@tom/schemas/jsonld";
import { Metadata } from "./Meta";

const resolveProp = (value: string | Accessor<string> | undefined): string | undefined =>
  value instanceof Function ? value() : value;

const styles = stylex.create({
  main: {
    marginInline: "auto",
    padding: "2rem",
    maxWidth: "750px",
  },
});

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
  jsonLd?: JsonLd;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export const PageLayout: Component<PageLayoutProps> = (props) => {
  const title = createMemo(() => props.frontmatter?.title ?? resolveProp(props.title) ?? "");
  const description = createMemo(
    () => props.frontmatter?.summary ?? resolveProp(props.description) ?? "",
  );
  const canonical = createMemo(() => resolveProp(props.canonical));
  // canonical is static per mount (a prop), so a one-time read is honest.
  const canonicalUrl = untrack(() => canonical());

  return (
    <div {...stylex.attrs(props.style)}>
      <Metadata
        title={title()}
        metaType="description"
        metaContent={description()}
        {...(canonicalUrl && { canonical: canonicalUrl })}
      />
      {props.jsonLd && (
        <script type="application/ld+json" innerHTML={JSON.stringify(props.jsonLd)} />
      )}
      <main id="main" {...stylex.attrs(styles.main)}>
        {props.children}
      </main>
    </div>
  );
};
