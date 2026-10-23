import { Elysia } from "elysia";
import { resizeImageRoute } from "./get-image";

export const imageIntegration = new Elysia({ name: "image" }).use(resizeImageRoute);
