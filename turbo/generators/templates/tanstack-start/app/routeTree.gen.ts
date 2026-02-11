import { RootRoute } from "@tanstack/react-router";

const rootRoute = new RootRoute({
  component: () => null,
});

const indexRoute = rootRoute.createRoute({
  path: "/",
  component: () => null,
});

export const routeTree = rootRoute.addChildren([indexRoute]);
