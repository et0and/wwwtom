import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Option, Redacted, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";

export class CredentialsError extends Schema.TaggedError<CredentialsError>()("CredentialsError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export type TursoCredentialsService = {
  /** Organization slug every request path is scoped to. */
  readonly organization: string;
  /** Platform API token. Stays in `Redacted`; never logged. */
  readonly token: Redacted.Redacted;
};

export class TursoCredentials extends Context.Service<TursoCredentials, TursoCredentialsService>()(
  "TursoCredentials",
) {}

/** Deploy-time TOM_SECRETS copy; absent or malformed bundles read as empty. */
const parseBundle = (): Record<string, string> => {
  const raw = process.env.TOM_SECRETS;
  return raw === undefined
    ? {}
    : Option.getOrElse(Schema.decodeUnknownOption(TomSecretsSchema)(raw), () => ({}));
};

/**
 * The deploy-time bundle, shared with `turso.run.ts` so both read it once and
 * agree on the parsing rules. Callers snapshot it per run because `TOM_SECRETS`
 * is read from the environment, which tests swap.
 */
export const secretBundle = parseBundle;

const required = (
  label: string,
  value: string | undefined,
  message: string,
): Effect.Effect<string, CredentialsError> =>
  value !== undefined && value.trim() !== ""
    ? Effect.succeed(value.trim())
    : Effect.fail(new CredentialsError({ message: `${label} ${message}` }));

/**
 * The platform token is a control-plane credential, so it is scoped to a single
 * organization (Turso deprecated unrestricted cross-org tokens). The slug is
 * therefore a property of the credential, not a free input on every resource:
 * `readSecretBundle` in `shared.run.ts` is not reused here because its failure
 * message is about seeding the Cloudflare Secrets Store, which would mislead
 * here. Explicit env wins over the bundle, matching the rest of `infra/`.
 */
export const TursoCredentialsLive = Layer.effect(
  TursoCredentials,
  Effect.gen(function* () {
    const bundle = parseBundle();
    const organization = yield* required(
      "TURSO_ORG",
      process.env.TURSO_ORG ?? bundle.TURSO_ORG,
      "must be the organization slug the platform token is scoped to",
    );
    const token = yield* required(
      "TURSO_API_TOKEN",
      process.env.TURSO_API_TOKEN ?? bundle.TURSO_API_TOKEN,
      "must be an organization-scoped Turso platform API token (see `turso auth api-tokens mint --org`)",
    );

    return { organization, token: Redacted.make(token) };
  }),
);
