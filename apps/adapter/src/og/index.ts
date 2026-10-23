import { Elysia } from "elysia";
import { proxyOgRoute } from "./proxy-og";

export const ogIntegration = new Elysia({ name: "og" }).use(proxyOgRoute);
