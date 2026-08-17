import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import adapterWorker from "@tom/adapter";
import type { CloudflareEnv } from "@tom/utils/services/config";

/**
 * Plain-Node harness for the real adapter worker entry (apps/adapter).
 * The adapter runs as a Cloudflare Worker in production; under Node we
 * translate http req/res → web Request/Response and call the exact default
 * export (`worker.fetch(request, env)`), the same signature Cloudflare invokes.
 *
 * The env mirrors the worker bindings shape and points every upstream at the
 * fixture simulator. `SIMULATOR_URL` is set, so the adapter's built-in
 * x-use-simulator switching (apps/adapter/src/simulator.ts) works both here
 * and, for parity, on a real deployed stack that opts in.
 */
const PORT = Number(process.env.ADAPTER_PORT ?? 8788);
const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://127.0.0.1:8789";

const env: CloudflareEnv = {
  NODE_ENV: "production",
  ADAPTER_URL: `http://127.0.0.1:${PORT}`,
  GUESTBOOK_RETURN_URL: "http://127.0.0.1:3000/guestbook",
  API_URL: SIMULATOR_URL,
  ARENA_API_URL: SIMULATOR_URL,
  POLAR_API_URL: SIMULATOR_URL,
  PAYLOAD_URL: SIMULATOR_URL,
  SIMULATOR_URL,
  // Telegram error alerts must no-op (no real credentials in CI); failures
  // are swallowed by sendErrorAlert itself.
  TELEGRAM_BOT_TOKEN: "e2e",
  TELEGRAM_CHAT_ID: "e2e",
};

const fromNodeRequest = (req: IncomingMessage): Request => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const init: RequestInit & { duplex: "half" } = {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method === "GET" || req.method === "HEAD" ? undefined : (Readable.toWeb(req) as BodyInit),
    duplex: "half",
  };
  return new Request(url, init);
};

const writeResponse = async (res: ServerResponse, response: Response) => {
  // Node collapses duplicate set-cookie headers; join with \n like the fetch
  // spec's Headers does, so guestbook cookie writes survive.
  const headers: Record<string, string> = {};
  for (const [key, value] of response.headers.entries()) {
    headers[key] = key === "set-cookie" && headers[key] ? `${headers[key]}\n${value}` : value;
  }
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
};

createServer((req, res) => {
  Promise.resolve(adapterWorker.fetch(fromNodeRequest(req), env))
    .then((response) => writeResponse(res, response))
    .catch((cause: unknown) => {
      console.error("Adapter harness error", cause);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Adapter harness error" }));
    });
}).listen(PORT, () => {
  console.log(`Adapter (fixture mode) listening on http://127.0.0.1:${PORT}`);
  console.log(`  upstreams → ${SIMULATOR_URL} (x-use-simulator enabled)`);
});
