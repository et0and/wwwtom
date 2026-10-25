import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { AgentMessageInputSchema } from "@tom/schemas/agent";
import { askAgent, runAgent } from "./shared";
import { getRequestEnv } from "@tom/utils/worker";
import { tenantFromValue } from "@tom/utils/config";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";

/**
 * Send one message to the agent and get the reply. Adapter-only (the guarded
 * group checks the internal token) and Tom-only: Sophie gets a 404, and the
 * AGENT_CHAT binding only exists on the Tom worker in the first place.
 */
export const postAgentMessageRoute = new Elysia().post(
  "/agent/message",
  ({ body, request }) => {
    const env = getRequestEnv(request);
    return runAgent(
      tenantFromValue(env.TENANT) === "tom"
        ? askAgent(env, body)
        : Effect.fail(new HttpError({ message: "Not found", status: HttpStatus.NotFound })),
      request,
    );
  },
  {
    body: Schema.toStandardSchemaV1(AgentMessageInputSchema),
    detail: { description: "Send a message to the Telegram agent", tags: ["agent"] },
  },
);
