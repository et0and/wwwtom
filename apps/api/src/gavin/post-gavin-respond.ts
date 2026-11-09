import { Elysia } from "elysia";
import { Effect, Option, Redacted, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import type { GavinReply } from "@tom/schemas/gavin";
import { GavinReplySchema, GavinRequestSchema, OpenCodeResponsesSchema } from "@tom/schemas/gavin";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { HttpError } from "@tom/types/errors";
import { tenantFromValue } from "@tom/utils/config";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/worker";

const GavinRequestBodySchema = Schema.toStandardSchemaV1(GavinRequestSchema);

const SYSTEM_PROMPT = `You are Gavin, a small desk companion. You have two narrow white eyes on a black screen.
The user is speaking to you through a web page. You cannot see or hear; their words arrive as text.
Reply in one or two short, warm, curious sentences. Do not use markdown.
Also choose one eye mood: idle, listening, thinking, speaking, happy, sleepy, or surprised.
Return only JSON with this shape: {"reply":"...","mood":"idle"}.`;

const DEFAULT_MODEL = "muse-spark-1.3-contributor";

type OpenCodeConfig = {
  readonly baseUrl: string;
  readonly apiKey: Redacted.Redacted<string>;
  readonly model: string;
};

const notConfigured = (): HttpError =>
  new HttpError({
    status: HttpStatus.ServiceUnavailable,
    message: "Gavin is not configured",
  });

const cleanModelText = (content: string): GavinReply | null => {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return Option.getOrNull(
    Schema.decodeUnknownOption(Schema.fromJsonString(GavinReplySchema))(cleaned),
  );
};

/**
 * The OpenCode Go key is deliberately absent from the shared secretKeys list,
 * so readCloudflareEnv never materializes it into the adapter workers. This
 * route reads it straight from the TOM_SECRETS binding, like the Google OAuth
 * broker does.
 */
const readOpenCodeConfig = Effect.fn("Gavin.readConfig")(function* (request: Request) {
  const env = getRequestEnv(request);
  if (tenantFromValue(env.TENANT) === "sophie") {
    return yield* new HttpError({
      status: HttpStatus.NotFound,
      message: "Not found",
    });
  }

  const explicitBaseUrl = env.OPENCODE_GO_BASE_URL?.trim();
  const explicitApiKey = env.OPENCODE_GO_API_KEY?.trim();
  const explicitModel = env.OPENCODE_GO_MODEL?.trim();
  if (explicitBaseUrl && explicitApiKey) {
    return {
      baseUrl: explicitBaseUrl.replace(/\/+$/, ""),
      apiKey: Redacted.make(explicitApiKey),
      model: explicitModel || DEFAULT_MODEL,
    } satisfies OpenCodeConfig;
  }

  const binding = env.TOM_SECRETS;
  if (binding === undefined) return yield* notConfigured();

  const raw = yield* Effect.tryPromise({
    try: () => binding.get(),
    catch: (cause) =>
      new HttpError({
        status: HttpStatus.ServiceUnavailable,
        message: "Gavin is not configured",
        cause,
      }),
  });
  const bundle = yield* Schema.decodeEffect(TomSecretsSchema)(raw).pipe(
    Effect.mapError(
      (cause) =>
        new HttpError({
          status: HttpStatus.InternalServerError,
          message: "Gavin configuration is invalid",
          cause,
        }),
    ),
  );
  const baseUrl = bundle.OPENCODE_GO_BASE_URL?.trim();
  const apiKey = bundle.OPENCODE_GO_API_KEY?.trim();
  const model = bundle.OPENCODE_GO_MODEL?.trim();
  if (!baseUrl || !apiKey) return yield* notConfigured();

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: Redacted.make(apiKey),
    model: model || DEFAULT_MODEL,
  } satisfies OpenCodeConfig;
});

const respondToGavin = Effect.fn("Gavin.respond")(function* (request: Request, transcript: string) {
  const config = yield* readOpenCodeConfig(request);
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${Redacted.value(config.apiKey)}`,
          "content-type": "application/json",
          "user-agent": "gavin-frame/1.0",
          "x-opencode-session": "gavin-desk-frame",
        },
        body: JSON.stringify({
          model: config.model,
          instructions: SYSTEM_PROMPT,
          input: transcript,
          max_output_tokens: 600,
          reasoning: { effort: "low" },
        }),
        signal: AbortSignal.timeout(30000),
      }),
    catch: (cause) =>
      new HttpError({
        status: HttpStatus.BadGateway,
        message: "Gavin could not answer",
        cause,
      }),
  });

  if (!response.ok) {
    yield* Effect.logWarning("OpenCode Go rejected Gavin", {
      status: response.status,
    });
    return yield* new HttpError({
      status: HttpStatus.BadGateway,
      message: "Gavin could not answer",
    });
  }

  const payload: unknown = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) =>
      new HttpError({
        status: HttpStatus.BadGateway,
        message: "Gavin returned an invalid answer",
        cause,
      }),
  });
  const completion = Option.getOrNull(Schema.decodeUnknownOption(OpenCodeResponsesSchema)(payload));
  const outputText = completion?.output_text;
  const content = (
    outputText ??
    completion?.output
      .flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text" && item.text !== undefined)?.text
  )?.trim();
  if (!content) {
    return yield* new HttpError({
      status: HttpStatus.BadGateway,
      message: "Gavin returned an empty answer",
    });
  }

  const parsed = cleanModelText(content);
  const reply: GavinReply = parsed ?? {
    reply: content.slice(0, 1000),
    mood: "idle",
  };
  yield* Effect.logInfo("Gavin replied", { mood: reply.mood });
  return reply;
});

export const respondRoute = new Elysia().post(
  "/gavin/respond",
  ({ body, request, set }) => {
    set.headers["cache-control"] = "no-store";
    set.headers["pragma"] = "no-cache";
    return runEffect(
      respondToGavin(request, body.transcript),
      logContextFromRequest(request, "tom-api"),
    );
  },
  {
    body: GavinRequestBodySchema,
    detail: {
      description: "Ask Gavin for a short reply and eye mood (adapter only)",
      tags: ["frame"],
    },
  },
);
