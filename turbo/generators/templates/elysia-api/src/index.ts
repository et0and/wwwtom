import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => ({ message: "Hello from {{name}}" }))
  .get("/health", () => ({ status: "ok" }))
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
