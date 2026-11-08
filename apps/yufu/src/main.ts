import { Schema } from "effect";
import { Runtime, type Update } from "foldkit";
import { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";

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

export const view = (_model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Yufu",
  body: h.main(
    [h.Class("page")],
    [h.h1([h.Class("title")], ["Yufu"]), h.p([h.Class("tagline")], ["A blank page."])],
  ),
});
