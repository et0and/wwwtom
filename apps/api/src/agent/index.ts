import { Elysia } from "elysia";
import { postAgentMessageRoute } from "./post-agent-message";

export const agentRoutes = new Elysia({ name: "agent" }).use(postAgentMessageRoute);
