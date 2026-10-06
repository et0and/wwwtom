import { Elysia } from "elysia";
import { versionRoute } from "./get-version";

export const githubIntegration = new Elysia({ name: "github" }).use(versionRoute);
