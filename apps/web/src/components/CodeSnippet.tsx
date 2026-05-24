import { Show, createResource } from "solid-js";
import { highlightCodeToHtml } from "~/libs/actions/payload/highlight";

export interface CodeSnippetProps {
  code: string;
  language?: string;
  fileName?: string;
  showLineNumbers?: boolean;
}

export function CodeSnippet(props: CodeSnippetProps) {
  const [highlighted] = createResource(
    () => ({
      code: props.code,
      lang: props.language,
      fileName: props.fileName,
      showLineNumbers: props.showLineNumbers,
    }),
    async (p) => {
      const [light, dark] = await Promise.all([
        highlightCodeToHtml(p.code, p.lang || "text", "github-light"),
        highlightCodeToHtml(p.code, p.lang || "text", "vitesse-dark"),
      ]);
      return { light, dark, fileName: p.fileName, showLineNumbers: p.showLineNumbers };
    },
  );

  return (
    <Show
      when={highlighted()}
      fallback={
        <figure class="code-block" data-line-numbers={props.showLineNumbers}>
          {props.fileName ? <figcaption class="code-filename">{props.fileName}</figcaption> : null}
          <pre>
            <code>{props.code}</code>
          </pre>
        </figure>
      }
    >
      {(data) => (
        <figure class="code-block" data-line-numbers={data().showLineNumbers}>
          {data().fileName ? (
            <figcaption class="code-filename">{data().fileName}</figcaption>
          ) : null}
          <div class="shiki-light" innerHTML={data().light} />
          <div class="shiki-dark" innerHTML={data().dark} />
        </figure>
      )}
    </Show>
  );
}
