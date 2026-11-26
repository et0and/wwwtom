import { Head, Router, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Schema } from "effect";

import { About } from "./pages/About";
import { PostsPage } from "./pages/PostsPage";
import { AppRoute } from "./routes";

export const AppMessage = UiSchema.TaggedEnum({
  ChangedRoute: { route: AppRoute },
});

export const App = Html.component({
  name: "App",
  props: Schema.Struct({ route: AppRoute }),
  model: Schema.Struct({ route: AppRoute }),
  message: AppMessage,
}).make({
  init: ($) => ({ route: $.props.route }),
  update: {
    ChangedRoute: ($, { route }) => ({ route }),
  },
  subscriptions: ({ model }) => [
    Router.subscription(AppRoute, model.route, (route) => AppMessage.ChangedRoute({ route })),
  ],
  head: () => [Head.titleTemplate((title) => `${title} - web-effectui`), HtmlHead.lang("en")],
  view: (h, model) =>
    h.div.children(
      AppRoute.match(model.route, {
        About: () => About(h, {}),
        Posts: () => PostsPage(h, { key: "/posts" }),
        NotFound: () => h.h1.children("Page not found"),
      }),
    ),
});
