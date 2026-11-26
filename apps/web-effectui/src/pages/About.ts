import { Head } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

export const About = Html.component({
  name: "About",
  model: Schema.Null,
  message: Schema.Never,
}).make({
  init: () => null,
  update: ($) => $.model,
  head: () => [Head.title("About")],
  view: (h) =>
    h.main.children(
      h.h1.children("About"),
      h.p.children("This page is rendered by Effect UI on the server."),
    ),
});
