import { Elysia } from "elysia";
import { getFrameStateRoute } from "./get-frame-state";
import { putFrameStateRoute } from "./put-frame-state";

export const frameIntegration = new Elysia({ name: "frame" })
  .use(getFrameStateRoute)
  .use(putFrameStateRoute);
