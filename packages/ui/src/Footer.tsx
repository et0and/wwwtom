import { Show } from "solid-js";

export function Footer(props: { version?: string | undefined; commitHash?: string | undefined }) {
  const currentYear = new Date().getFullYear();
  return (
    <footer class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-6 py-4 text-sm flex-shrink-0 md:sticky md:bottom-0 md:border-t md:border-tomui-line">
      <p>
        &copy; {currentYear} <a href="/accessibility">Accessibility</a>.{" "}
        <a href="https://webring.xxiivv.com/#random">Webring</a>.{" "}
        <Show
          when={
            props.version && props.commitHash
              ? { version: props.version, commitHash: props.commitHash }
              : undefined
          }
        >
          {(build) => (
            <>
              <a href={`https://github.com/et0and/wwwtom/commit/${build().commitHash}`}>
                v{build().version}-{build().commitHash}
              </a>
              .
            </>
          )}
        </Show>
      </p>
    </footer>
  );
}
