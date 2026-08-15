import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

/**
 * The single Turnstile widget guarding user-generated content flows (the
 * guestbook sign form for now). Referenced from both the adapter stack
 * (server-side siteverify secret) and the web stack (client-side sitekey).
 *
 * Production adopts the plain `wwwtom` widget; other stages get a
 * per-stage widget (`wwwtom-${stage}`) so a per-stage `alchemy destroy`
 * (e.g. the PR-preview cleanup) never deletes the production widget.
 *
 * Domains cover the web apex `tom.so` — subdomains are covered
 * automatically — plus `localhost`/`127.0.0.1` so the widget can render
 * during local development. Which hostnames a deployment actually accepts
 * is decided server-side by the adapter's siteverify hostname check.
 */
export const turnstileWidget = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Turnstile.Widget("wwwtom", {
    name: stage === "production" ? "wwwtom" : `wwwtom-${stage}`,
    domains: ["tom.so", "localhost", "127.0.0.1"],
    mode: "managed",
  });
});
