import { Elysia } from "elysia";
import { generateImageRoute } from "./generate-image";

export const ogRoutes = new Elysia({ name: "og" }).use(generateImageRoute);
