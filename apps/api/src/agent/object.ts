import { Effect } from "effect";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/config";
import { runEffect } from "@tom/utils/worker";
import { runAgentTurn } from "./shared";
import type { AgentChatState } from "./storage";

/**
 * The agent Durable Object this worker hosts (binding AGENT_CHAT, class
 * AgentChat). One instance per chat: single-threaded turn serialization plus
 * the storage the chat transcript persists into. Plain class with the classic
 * (state, env) constructor — TS 7 skips URI-like specifiers such as
 * "cloudflare:workers", so the base class stays out of the program; workerd
 * instantiates any exported DO class. RPC methods carry JSON values only, so
 * `ask` returns the reply text and the route maps failures.
 */
export class AgentChat {
  readonly env: CloudflareEnv;
  readonly storage: AgentChatState["storage"];

  constructor(state: AgentChatState, env: CloudflareEnv) {
    this.env = env;
    this.storage = state.storage;
  }

  async ask(message: string): Promise<string> {
    const env = await readCloudflareEnv(this.env);
    return runEffect(
      runAgentTurn(message, env, this.storage).pipe(Effect.map((response) => response.reply)),
      { serviceName: "tom-api" },
    );
  }
}
