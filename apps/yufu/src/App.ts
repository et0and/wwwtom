import { Head, Router, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Schema } from "effect";

import { MangaIndex } from "./manga/MangaIndex";
import { MangaReader } from "./manga/MangaReader";
import { Home } from "./main";
import { AppRoute } from "./routes";

const AppMessage = UiSchema.TaggedEnum({
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
  head: () => [Head.titleTemplate((title) => `${title} - Yufu`), HtmlHead.lang("en")],
  view: (h, model) =>
    h.div.children(
      AppRoute.match(model.route, {
        Home: () => Home(h, {}),
        MangaIndex: () => MangaIndex(h, { key: "/manga" }),
        MangaReader: (route) =>
          MangaReader(h, { key: route.params.id, props: { id: route.params.id } }),
        NotFound: () => h.h1.children("Page not found"),
      }),
    ),
});
