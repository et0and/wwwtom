import { createServer } from "node:http";
import { Readable } from "node:stream";
import { Elysia } from "elysia";
import { Effect } from "effect";
import { polarSimulator } from "./polar";
import { arenaSimulator } from "./arena";

const PORT = Number(process.env.SIMULATOR_PORT ?? 8789);

const app = new Elysia({ name: "tom-simulator" }).use(polarSimulator).use(arenaSimulator);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const requestInit: RequestInit & { duplex: "half" } = {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : (Readable.toWeb(req) as unknown as BodyInit),
    duplex: "half",
  };
  const request = new Request(url, requestInit);

  const sendResponse = (response: Response) =>
    Effect.tryPromise(() => response.arrayBuffer()).pipe(
      Effect.map((body) => Buffer.from(body)),
      Effect.flatMap((body) =>
        Effect.sync(() => {
          res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
          res.end(body);
        }),
      ),
    );

  const sendError = (error: unknown) =>
    Effect.sync(() => {
      console.error("Simulator request failed", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Simulator error" }));
    });

  Effect.runPromise(
    Effect.tryPromise(() => app.handle(request)).pipe(
      Effect.flatMap(sendResponse),
      Effect.matchEffect({
        onSuccess: () => Effect.void,
        onFailure: sendError,
      }),
    ),
  );
});

server.listen(PORT, () => {
  console.log(`Tom simulator listening on http://localhost:${PORT}`);
  console.log("  Polar: /v1/*");
  console.log("  Are.na: /v3/*");
});
