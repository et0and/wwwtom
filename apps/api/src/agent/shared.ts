import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { AiError, Chat, LanguageModel, Tool, Toolkit } from "effect/unstable/ai";
import { PersistenceError } from "effect/unstable/persistence/Persistence";
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import type { AgentMessageInput, AgentMessageResponse } from "@tom/schemas/agent";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { liveHttpClient } from "@tom/utils/http";
import type { CloudflareEnv } from "@tom/utils/config";
import { logContextFromRequest, runEffect } from "@tom/utils/worker";
import { durableObjectPersistenceLayer } from "./persistence";
import type { AgentChatStorage } from "./storage";

const AGENT_STORE_ID = "agent";
// One Durable Object instance exists per chat, so the persisted conversation
// id is a constant inside each instance.
const AGENT_CHAT_ID = "telegram";

/**
 * System prompt for the Telegram agent. It rides the Anthropic Messages
 * `system` field on every turn, so the persisted transcript holds only the
 * conversation itself.
 */
const AGENT_SYSTEM_PROMPT = [
  "You are Tom's personal agent, reachable over Telegram.",
  "Replies go out as plain text, so avoid markdown tables and code fences.",
  "Keep replies short and direct unless the question needs detail.",
].join(" ");

interface AgentConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/**
 * The agent's runtime contract, resolved once per turn at the env boundary.
 * Every value is required: the API key rides the TOM_SECRETS bundle, and the
 * stage config sets the OpenCode Go endpoint and model explicitly. Missing
 * config fails closed with a clear problem response.
 */
const agentConfig = (env: CloudflareEnv): Effect.Effect<AgentConfig, HttpError> =>
  Effect.gen(function* () {
    const apiKey = yield* Effect.fromOption(Option.fromNullishOr(env.AGENT_API_KEY), () =>
      unconfigured("AGENT_API_KEY"),
    );
    const baseUrl = yield* Effect.fromOption(Option.fromNullishOr(env.AGENT_BASE_URL), () =>
      unconfigured("AGENT_BASE_URL"),
    );
    const model = yield* Effect.fromOption(Option.fromNullishOr(env.AGENT_MODEL), () =>
      unconfigured("AGENT_MODEL"),
    );
    return { apiKey, baseUrl, model };
  });

const unconfigured = (variable: string): HttpError =>
  new HttpError({
    message: `Agent is not configured (${variable} missing)`,
    status: HttpStatus.ServiceUnavailable,
  });

/** The one tool the first turn ships: a timestamp, to prove tool calling. */
const CurrentTime = Tool.make("current_time", {
  description: "Get the current UTC timestamp in ISO 8601 format",
  success: Schema.String,
});

const agentToolkit = Toolkit.make(CurrentTime);

const agentToolkitHandlers = agentToolkit.toLayer({
  current_time: () => Effect.succeed(new Date().toISOString()),
});

/** Layers for one turn: the OpenCode Go model and the persisted chat. */
const agentLayers = (
  config: AgentConfig,
  storage: AgentChatStorage,
): Layer.Layer<Chat.Persistence | LanguageModel.LanguageModel> => {
  // OpenCode Go serves each model on one wire API; this provider speaks the
  // Anthropic Messages API, which Go exposes for its Claude/Qwen/MiniMax models.
  const client = AnthropicClient.layer({
    apiKey: Redacted.make(config.apiKey),
    apiUrl: config.baseUrl,
  }).pipe(Layer.provide(liveHttpClient()));
  const model = AnthropicLanguageModel.layer({
    model: config.model,
    config: { system: AGENT_SYSTEM_PROMPT },
  }).pipe(Layer.provide(client));
  const persistedChat = Chat.layerPersisted({ storeId: AGENT_STORE_ID }).pipe(
    Layer.provide(durableObjectPersistenceLayer(storage)),
  );
  return Layer.merge(model, persistedChat);
};

/** One turn: fetch-or-create the conversation, then generate a reply. */
const agentTurn = Effect.fn("AgentChat.turn")(function* (message: string) {
  const ready = yield* Effect.provide(agentToolkit, agentToolkitHandlers);
  const persistence = yield* Chat.Persistence;
  const conversation = yield* persistence.getOrCreate(AGENT_CHAT_ID);
  const response = yield* conversation.generateText({
    prompt: message,
    toolkit: ready,
  });
  return response.text;
});

/**
 * One turn: resolve config, then run the conversation against the hosting
 * Durable Object's storage. `Chat.Persisted` saves the transcript after every
 * round, so a run continues from its last checkpoint after eviction. Model and
 * persistence failures collapse into one precise HttpError.
 */
export const runAgentTurn = (
  message: string,
  env: CloudflareEnv,
  storage: AgentChatStorage,
): Effect.Effect<AgentMessageResponse, HttpError> =>
  Effect.gen(function* () {
    const config = yield* agentConfig(env);
    const reply = yield* agentTurn(message).pipe(
      Effect.provide(agentLayers(config, storage)),
      Effect.mapError(normalizeAgentError),
    );
    return { reply };
  });

/** Keep an HttpError's exact status; a model or persistence failure becomes a 500. */
const normalizeAgentError = (error: HttpError | AiError.AiError | PersistenceError): HttpError =>
  Schema.is(HttpError)(error)
    ? error
    : new HttpError({
        message: "Agent turn failed",
        status: HttpStatus.InternalServerError,
        cause: error,
      });

/** Run an agent effect with request logging; HttpError rejects and the
 * worker onError hook maps it to an RFC 9457 problem response. */
export const runAgent = <A>(effect: Effect.Effect<A, HttpError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

/**
 * Call the agent from its route: resolves the AGENT_CHAT binding and turns a
 * missing binding or a failed turn into a precise HttpError. Tenant gating
 * lives in the route; the binding itself only exists on the Tom worker.
 */
export const askAgent = (
  env: CloudflareEnv,
  input: AgentMessageInput,
): Effect.Effect<AgentMessageResponse, HttpError> =>
  Effect.gen(function* () {
    const namespace = yield* Effect.fromOption(
      Option.fromNullishOr(env.AGENT_CHAT),
      () =>
        new HttpError({
          message: "Agent storage is not configured",
          status: HttpStatus.InternalServerError,
        }),
    );
    return yield* Effect.tryPromise({
      try: () => namespace.getByName(input.chatId).ask(input.message),
      catch: (cause) =>
        new HttpError({
          message: "Agent turn failed",
          status: HttpStatus.BadGateway,
          cause,
        }),
    }).pipe(Effect.map((reply) => ({ reply })));
  });
