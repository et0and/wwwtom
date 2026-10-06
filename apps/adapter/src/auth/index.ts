import { Elysia } from "elysia";
import { handleAuthRoute } from "./proxy-auth";

export const authIntegration = new Elysia({ name: "auth" }).use(handleAuthRoute);
