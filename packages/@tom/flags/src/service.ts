/**
 * Effect-native flag evaluation for server callers.
 *
 * Two ways to build the layer:
 * - {@link Flags.Binding} adapts a live Cloudflare Flagship binding
 *   (`env.FLAGS`) so evaluations run against the real app.
 * - {@link Flags.Static} evaluates against in-memory overrides — for tests
 *   and local development with no Flagship app nearby. Any flag without an
 *   override resolves to its default.
 *
 * Evaluations never fail for a missing flag or a disabled flag — the flag's
 * default is returned with a reason. The `FlagsError` channel surfaces only
 * unexpected runtime failures (misconfigured binding, network errors).
 *
 * {@link evaluateFlags} evaluates a used-only list of flags into a
 * deliverable list of `[name, evaluation]` pairs — the shared path behind
 * the SSR snapshot and the API refetch route.
 *
 * @example
 * ```ts
 * const enabled = yield* Effect.gen(function* () {
 *   const flags = yield* Flags;
 *   return yield* flags.evaluate("dark-mode", { userId: "user-42" });
 * }).pipe(Effect.provide(Flags.Binding(env.FLAGS)));
 * ```
 */
import { Context, Effect, Layer } from "effect";
import { FlagsError } from "@tom/types/errors";
import { flags, type FlagName } from "./registry.js";
import type { FlagEvaluation, FlagEvaluationContext, FlagshipBinding } from "./binding.js";

export interface FlagsContract {
  /** Resolve a flag by key, falling back to the flag's default. */
  readonly evaluate: (
    name: FlagName,
    context?: FlagEvaluationContext,
  ) => Effect.Effect<FlagEvaluation, FlagsError>;
}

const toFlagsError =
  (operation: string) =>
  (cause: unknown): FlagsError =>
    cause instanceof FlagsError
      ? cause
      : new FlagsError({ message: `Failed to ${operation}`, cause });

const makeFlags = (binding: FlagshipBinding): FlagsContract => ({
  evaluate: (name, context) =>
    Effect.tryPromise({
      try: () => binding.getBooleanDetails(name, flags[name].defaultValue, context),
      catch: toFlagsError(`evaluate flag ${name}`),
    }).pipe(Effect.withSpan("Flags.evaluate")),
});

const stubBinding = (overrides: FlagOverrides): FlagshipBinding => ({
  getBooleanDetails: (flagKey, defaultValue, _context) =>
    Promise.resolve({
      value: overrides[flagKey as FlagName] ?? defaultValue,
      ...(flagKey in overrides ? { reason: "CACHED" } : { reason: "DEFAULT" }),
    }),
});

/** Boolean overrides keyed by fully typed flag name. */
export type FlagOverrides = { readonly [Name in FlagName]?: boolean };

export class Flags extends Context.Service<Flags, FlagsContract>()("Flags") {
  /**
   * Live layer backed by a Cloudflare Flagship binding. Pass the Worker's
   * `env.FLAGS` in production.
   */
  static readonly Binding = (binding: FlagshipBinding): Layer.Layer<Flags, never> =>
    Layer.succeed(Flags, makeFlags(binding));

  /**
   * In-memory layer for tests and local development. `overrides` maps flag
   * names to values; flags without an override resolve to their default.
   */
  static readonly Static = (overrides: FlagOverrides = {}): Layer.Layer<Flags, never> =>
    Layer.succeed(Flags, makeFlags(stubBinding(overrides)));
}

/**
 * Evaluate exactly the listed flags (the used-only list) into
 * `[name, evaluation]` pairs, ready to be turned into a snapshot for the
 * client (SSR embed or JSON refetch response).
 */
export const evaluateFlags = (
  names: readonly FlagName[],
  context?: FlagEvaluationContext,
): Effect.Effect<readonly (readonly [FlagName, FlagEvaluation])[], FlagsError, Flags> =>
  Effect.forEach(names, (name) =>
    Effect.flatMap(Flags, (flags) => flags.evaluate(name, context)).pipe(
      Effect.map((evaluation) => [name, evaluation] as const),
    ),
  ).pipe(Effect.withSpan("Flags.evaluateFlags"));
