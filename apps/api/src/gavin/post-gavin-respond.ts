import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import type { GavinReply } from "@tom/schemas/gavin";
import { GavinReplySchema, GavinRequestSchema } from "@tom/schemas/gavin";
import { HttpError } from "@tom/types/errors";
import { readCloudflareEnv, tenantFromValue } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";

const GavinRequestBodySchema = Schema.toStandardSchemaV1(GavinRequestSchema);

const OpenCodeResponseItemSchema = Schema.Struct({
  type: Schema.optional(Schema.String),
  content: Schema.optional(
    Schema.Array(
      Schema.Struct({
        type: Schema.optional(Schema.String),
        text: Schema.optional(Schema.String),
      }),
    ),
  ),
});

const OpenCodeResponsesSchema = Schema.Struct({
  output_text: Schema.optional(Schema.String),
  output: Schema.Array(OpenCodeResponseItemSchema),
});

const SYSTEM_PROMPT = `You are Gavin, a small desk companion. You have two narrow white eyes on a black screen.
The user is speaking to you through a web page. You cannot see or hear; their words arrive as text.
Reply in one or two short, warm, curious sentences. Do not use markdown.
Also choose one eye mood: idle, listening, thinking, speaking, happy, sleepy, or surprised.
Return only JSON with this shape: {"reply":"...","mood":"idle"}.`;

const cleanModelText = (content: string): GavinReply | null => {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return Option.getOrNull(
    Schema.decodeUnknownOption(Schema.fromJsonString(GavinReplySchema))(cleaned),
  );
};

export const respondRoute = new Elysia().post(
  "/gavin/respond",
  async ({ body, request }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    if (tenantFromValue(env.TENANT) === "sophie") {
      throw new HttpError({
        status: HttpStatus.NotFound,
        message: "Not found",
      });
    }
    const baseUrl = env.OPENCODE_GO_BASE_URL?.replace(/\/+$/, "");
    const apiKey = env.OPENCODE_GO_API_KEY;
    const model = env.OPENCODE_GO_MODEL ?? "muse-spark-1.3-contributor";
    if (!baseUrl || !apiKey) {
      throw new HttpError({
        status: HttpStatus.ServiceUnavailable,
        message: "Gavin is not configured",
      });
    }

    const response = await Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/responses`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
              "user-agent": "gavin-frame/1.0",
              "x-opencode-session": "gavin-desk-frame",
            },
            body: JSON.stringify({
              model,
              instructions: SYSTEM_PROMPT,
              input: body.transcript,
              max_output_tokens: 600,
              reasoning: { effort: "low" },
            }),
            signal: AbortSignal.timeout(30000),
          }),
        catch: () =>
          new HttpError({
            status: HttpStatus.BadGateway,
            message: "Gavin could not answer",
          }),
      }),
    );

    if (!response.ok) {
      throw new HttpError({
        status: HttpStatus.BadGateway,
        message: "Gavin could not answer",
      });
    }

    const payload: unknown = await Effect.runPromise(
      Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new HttpError({
            status: HttpStatus.BadGateway,
            message: "Gavin returned an invalid answer",
          }),
      }),
    );
    const completion = Option.getOrNull(
      Schema.decodeUnknownOption(OpenCodeResponsesSchema)(payload),
    );
    const outputText = completion?.output_text;
    const content = (
      outputText ??
      completion?.output
        .flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text" && item.text !== undefined)?.text
    )?.trim();
    if (!content) {
      throw new HttpError({
        status: HttpStatus.BadGateway,
        message: "Gavin returned an empty answer",
      });
    }

    const parsed = cleanModelText(content);
    if (parsed !== null) return parsed;
    return {
      reply: content.slice(0, 1000),
      mood: "idle",
    } satisfies GavinReply;
  },
  {
    body: GavinRequestBodySchema,
    detail: {
      description: "Ask Gavin for a short reply and eye mood (adapter only)",
      tags: ["frame"],
    },
  },
);
