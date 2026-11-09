import { Elysia } from "elysia";
import { respondRoute } from "./respond";

export const gavinIntegration = new Elysia({ name: "gavin" }).use(respondRoute);
