import { Schema } from "effect";

/**
 * Wire contracts for the Telegram agent. The api hosts the agent (Chat
 * transcript in a Durable Object); the adapter's Telegram webhook forwards
 * messages into it. `chatId` is a string so external chat systems (Telegram
 * uses signed integers) never lose a value across the boundary.
 */
export const AgentMessageInputSchema = Schema.Struct({
  chatId: Schema.NonEmptyString,
  message: Schema.NonEmptyString,
});

export type AgentMessageInput = Schema.Schema.Type<typeof AgentMessageInputSchema>;

export const AgentMessageResponseSchema = Schema.Struct({
  reply: Schema.String,
});

export type AgentMessageResponse = Schema.Schema.Type<typeof AgentMessageResponseSchema>;
