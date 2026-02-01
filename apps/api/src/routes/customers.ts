import { Hono } from "hono";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { createPolarCustomer } from "../services/polar";
import { runEffect } from "../config/effect";
import type { Env } from "../config/effect";

export const customerRoutes = new Hono<{ Bindings: Env }>();

customerRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { email, name, externalId } = body;

  if (!email) {
    return c.json({ error: "Email is required" }, HttpStatus.BadRequest);
  }

  const result = await runEffect(
    createPolarCustomer(email, name, externalId, c.env.POLAR_ACCESS_TOKEN).pipe(
      Effect.tapError((error) => Effect.logError("Error creating Polar customer", error)),
    ),
  );

  if (result instanceof Response) {
    return result;
  }

  return c.json(result, HttpStatus.Created);
});
