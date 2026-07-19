import { Hono } from "hono";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import {
  fetchPolarProducts,
  fetchPolarProduct,
  createPolarCustomer,
  handlePolarError,
} from "../services/polar";
import { resolveEnv, runEffect } from "../config/effect";
import type { Env } from "../config/effect";

const withErrorHandling = <A, E>(
  effect: Effect.Effect<A, E>,
  errorMessage: string,
  handler: (error: E) => Response,
) =>
  effect.pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(errorMessage, error);
        return yield* Effect.succeed(handler(error));
      }),
    ),
  );

export const productRoutes = new Hono<{ Bindings: Env }>();

productRoutes.get("/", async (c) => {
  const env = await resolveEnv(c.env);
  const result = await runEffect(
    withErrorHandling(
      fetchPolarProducts(env.POLAR_ACCESS_TOKEN),
      "Error fetching Polar products",
      handlePolarError,
    ),
  );

  if (result instanceof Response) return result;
  return c.json(result);
});

productRoutes.get("/:productId", async (c) => {
  const env = await resolveEnv(c.env);
  const productId = c.req.param("productId");

  if (!productId) {
    return c.json({ error: "Product ID is required" }, HttpStatus.BadRequest);
  }

  const result = await runEffect(
    withErrorHandling(
      fetchPolarProduct(productId, env.POLAR_ACCESS_TOKEN),
      "Error fetching Polar product",
      handlePolarError,
    ),
  );

  if (result instanceof Response) return result;
  return c.json(result);
});

productRoutes.post("/customers", async (c) => {
  const env = await resolveEnv(c.env);
  const body = await c.req.json();
  const { email, name, externalId } = body;

  if (!email) {
    return c.json({ error: "Email is required" }, HttpStatus.BadRequest);
  }

  const result = await runEffect(
    createPolarCustomer(email, name, externalId, env.POLAR_ACCESS_TOKEN).pipe(
      Effect.tapError((error) => Effect.logError("Error creating Polar customer", error)),
    ),
  );

  if (result instanceof Response) return result;
  return c.json(result, HttpStatus.Created);
});
