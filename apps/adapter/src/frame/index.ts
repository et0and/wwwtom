import { Elysia } from "elysia";
import { getFrameStateRoute } from "./get-frame-state";
import { putFrameGavinRoute } from "./put-frame-gavin";
import { putFrameStateRoute } from "./put-frame-state";

export const frameIntegration = new Elysia({ name: "frame" })
  .use(getFrameStateRoute)
  .use(putFrameStateRoute)
  .use(putFrameGavinRoute);
