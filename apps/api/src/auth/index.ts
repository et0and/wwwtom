import { Elysia } from "elysia";
import { handleAuthRoute } from "./handle-auth";

export const authRoutes = new Elysia({ name: "auth" }).use(handleAuthRoute);
