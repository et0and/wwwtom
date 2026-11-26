import * as stylex from "@stylexjs/stylex";
import { Head } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { styles } from "./styles.stylex";

const sx = (...values: ReadonlyArray<stylex.StyleXStyles>): string =>
  stylex.attrs(...values).class ?? "";

export const YufuPage = Html.component({
  name: "YufuPage",
  model: Schema.Null,
  message: Schema.Never,
}).make({
  init: () => null,
  update: ($) => $.model,
  head: () => [Head.title("Yufu")],
  view: (h) =>
    h.main
      .class(sx(styles.root))
      .children(
        h.pre
          .class(sx(styles.document))
          .children(
            h.code
              .class(sx(styles.code))
              .children(
                h.span
                  .class(sx(styles.header))
                  .children(
                    "YUFU ",
                    h.span.class(sx(styles.cursor)).children("█"),
                    "\nEFFECT UI WEB APP\n2026",
                  ),
                "\n\n",
                h.span.class(sx(styles.spaced)).children("~*~ © Yufu ~*~"),
                "\n\n",
                h.span.class(sx(styles.h1)).children("ABOUT YUFU"),
                "\n\nYufu is a blank Effect UI web app.\n\n",
                h.span.class(sx(styles.h2)).children("STACK"),
                "\n\nEffect UI, Effect, and StyleX.\n\n",
                h.span.class(sx(styles.h2)).children("LINKS"),
                "\n\n- [Effect UI](",
                h.a
                  .attr("href", "https://ui.effect.website")
                  .attr("target", "_blank")
                  .attr("rel", "noreferrer")
                  .class(sx(styles.link))
                  .children("https://ui.effect.website"),
                ")\n",
              ),
          ),
      ),
});
