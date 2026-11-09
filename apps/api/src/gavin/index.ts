import { Elysia } from "elysia";
import { respondRoute } from "./post-gavin-respond";

export const gavinRoutes = new Elysia({ name: "gavin" }).use(respondRoute);
