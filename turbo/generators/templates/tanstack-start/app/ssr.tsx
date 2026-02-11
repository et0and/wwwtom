import { createStartHandler, defaultStreamHandler } from "@tanstack/start/server";
import { getRouterManifest } from "@tanstack/start";
import { router } from "./router";

export default createStartHandler({
  createRouter,
  getRouterManifest,
})(defaultStreamHandler);

function createRouter() {
  return router;
}
