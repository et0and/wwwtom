import { Logger } from "effect";

/**
 * Logger layer for Cloudflare Workers.
 *
 * Emits structured JSON log entries via `console.log`, including:
 * - message, level, timestamp, cause
 * - annotations from Effect.annotateLogs()
 * - spans from Effect.withLogSpan() (elapsed milliseconds)
 * - fiberId
 *
 * Provide this layer at the outermost level of your Effect programs:
 *
 *   Effect.runPromise(program.pipe(Effect.provide(CloudflareLoggerLive)))
 */
export const CloudflareLoggerLive = Logger.json;
