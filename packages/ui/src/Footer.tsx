import { Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { fontSizeSm } from "./styles/typography.stylex";

const SM = "@media (min-width: 640px)";
const MD = "@media (min-width: 768px)";

const styles = stylex.create({
  footer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingInline: "1.5rem",
    paddingBlock: "1rem",
    fontSize: fontSizeSm.fontSize,
    lineHeight: fontSizeSm.lineHeight,
    flexShrink: 0,
    [SM]: { flexDirection: "row", alignItems: "center" },
    [MD]: { position: "sticky", bottom: 0 },
  },
});

export function Footer(props: { version?: string | undefined; commitHash?: string | undefined }) {
  const currentYear = new Date().getFullYear();
  return (
    <footer {...stylex.attrs(styles.footer)}>
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
