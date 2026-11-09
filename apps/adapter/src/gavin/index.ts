import { Elysia } from "elysia";
import { respondRoute } from "./post-gavin-respond";

export const gavinIntegration = new Elysia({ name: "gavin" }).use(respondRoute);
