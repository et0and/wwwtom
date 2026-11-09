import { Elysia } from "elysia";
import { respondRoute } from "./respond";

export const gavinRoutes = new Elysia({ name: "gavin" }).use(respondRoute);
