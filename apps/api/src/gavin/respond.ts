import { Elysia } from "elysia";
import { Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import type { GavinReply } from "@tom/schemas/gavin";
import { GavinReplySchema, GavinRequestSchema } from "@tom/schemas/gavin";
import { HttpError } from "@tom/types/errors";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";

const GavinRequestBodySchema = Schema.toStandardSchemaV1(GavinRequestSchema);

const OpenCodeCompletionSchema = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      message: Schema.Struct({ content: Schema.String }),
    }),
  ),
});

const MODEL = "muse-spark-1.3-contributor";
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
    const baseUrl = env.OPENCODE_GO_BASE_URL?.replace(/\/+$/, "");
    const apiKey = env.OPENCODE_GO_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new HttpError({
        status: HttpStatus.ServiceUnavailable,
        message: "Gavin is not configured",
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: body.transcript },
        ],
        temperature: 0.8,
        max_tokens: 160,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new HttpError({
        status: HttpStatus.BadGateway,
        message: "Gavin could not answer",
      });
    }

    const payload: unknown = await response.json();
    const completion = Option.getOrNull(
      Schema.decodeUnknownOption(OpenCodeCompletionSchema)(payload),
    );
    const content = completion?.choices[0]?.message.content.trim();
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
