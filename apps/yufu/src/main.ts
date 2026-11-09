import * as stylex from "@stylexjs/stylex";
import { Schema } from "effect";
import { Runtime, type Update } from "foldkit";
import { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";

import { styles } from "./styles.stylex";

// MODEL

export const Model = Schema.Struct({});
export type Model = typeof Model.Type;

// MESSAGE

export const Message = defineMessageUnion({});
export type Message = typeof Message.Type;

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {});

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {},
});

// VIEW

const sx = (...values: ReadonlyArray<stylex.StyleXStyles>): string =>
  stylex.attrs(...values).class ?? "";

export const view = (_model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Yufu",
  body: h.main(
    [h.Class(sx(styles.root))],
    [
      h.pre(
        [h.Class(sx(styles.document))],
        [
          h.code(
            [h.Class(sx(styles.code))],
            [
              h.span(
                [h.Class(sx(styles.header))],
                ["YUFU ", h.span([h.Class(sx(styles.cursor))], ["█"]), "\nFOLDKIT WEB APP\n2026"],
              ),
              "\n\n",
              h.span([h.Class(sx(styles.spaced))], ["~*~ © Yufu ~*~"]),
              "\n\n",
              h.span([h.Class(sx(styles.h1))], ["ABOUT YUFU"]),
              "\n\nYufu is a blank Foldkit web app.\n\n",
              h.span([h.Class(sx(styles.h2))], ["STACK"]),
              "\n\nFoldkit, Effect, and StyleX.\n\n",
              h.span([h.Class(sx(styles.h2))], ["LINKS"]),
              "\n\n- [Foldkit](",
              h.a(
                [
                  h.Href("https://foldkit.dev"),
                  h.Target("_blank"),
                  h.Rel("noreferrer"),
                  h.Class(sx(styles.link)),
                ],
                ["https://foldkit.dev"],
              ),
              ")\n",
            ],
          ),
        ],
      ),
    ],
  ),
});
