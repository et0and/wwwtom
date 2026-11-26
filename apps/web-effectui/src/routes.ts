import { Route } from "@effect/ui";

export const AppRoute = Route.union({
  About: Route.make("/about"),
  Posts: Route.make("/posts"),
  NotFound: Route.make("/*"),
});
