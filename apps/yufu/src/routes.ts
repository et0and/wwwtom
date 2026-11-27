import { Route } from "@effect/ui";
import { Schema } from "effect";

export const AppRoute = Route.union({
  Home: Route.make("/"),
  MangaIndex: Route.make("/manga"),
  MangaReader: Route.make("/manga/:id", { params: { id: Schema.String } }),
  NotFound: Route.make("/*"),
});
