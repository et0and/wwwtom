import { Elysia } from "elysia";
import { idParams, RedPixelPngBase64 } from "./data";

export const mediaFileRoute = new Elysia().get(
  "/media/:id/file",
  () =>
    new Response(Buffer.from(RedPixelPngBase64, "base64"), {
      headers: { "Content-Type": "image/png", "Cache-Control": "immutable, max-age=31536000" },
    }),
  {
    params: idParams,
    detail: { description: "Simulated media file bytes", tags: ["cms"] },
  },
);
