import { createServer } from "node:http";
import { Readable } from "node:stream";
import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { PortNumber } from "@tom/schemas/env";
import { arenaSimulator } from "./arena";
import { cmsSimulator } from "./cms";
import { guestbookSimulator } from "./guestbook";

const DEFAULT_PORT = 8789;

/**
 * Dev server port. A malformed SIMULATOR_PORT must fail here, loudly and by
 * name. Left to `Number()`, a typo like "8789x" reaches `server.listen` as
 * NaN and surfaces as a bare ERR_SOCKET_BAD_PORT.
 */
const PORT = (() => {
  const raw = process.env.SIMULATOR_PORT;
  if (raw === undefined) return DEFAULT_PORT;
  const decoded = Schema.decodeUnknownOption(PortNumber)(raw);
  if (decoded._tag === "None") {
    throw new Error(`SIMULATOR_PORT must be a port number between 1 and 65535, got "${raw}"`);
  }
  return decoded.value;
})();

const app = new Elysia({ name: "tom-simulator" })
  .use(arenaSimulator)
  .use(cmsSimulator)
  .use(guestbookSimulator);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const requestInit: RequestInit & { duplex: "half" } = {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method === "GET" || req.method === "HEAD" ? undefined : (Readable.toWeb(req) as BodyInit),
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

  const sendError = (cause: unknown) =>
    Effect.sync(() => {
      console.error("Simulator request failed", cause);
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
  console.log("  Are.na: /v3/*");
  console.log("  CMS: /posts, /works, /categories, /media/:id");
  console.log("  Guestbook: /guestbook/entries");
});
