import { Elysia } from "elysia";
import { postOAuthGoogleRefreshRoute } from "./google/post-oauth-google-refresh";
import { postOAuthGoogleTokenRoute } from "./google/post-oauth-google-token";

export const oauthRoutes = new Elysia({ name: "oauth" })
  .use(postOAuthGoogleTokenRoute)
  .use(postOAuthGoogleRefreshRoute);
