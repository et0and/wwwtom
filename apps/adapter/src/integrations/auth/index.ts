import { Elysia } from "elysia";
import { Schema } from "effect";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv } from "@tom/utils/services/worker";
import { simulatorEnv } from "../../simulator";

const SignInEmailSchema = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
});

const SignUpEmailSchema = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  password: Schema.String,
});

const SsoRegisterSchema = Schema.Struct({
  idpMetadata: Schema.Unknown,
  organizationId: Schema.optional(Schema.String),
  domain: Schema.optional(Schema.String),
});

const ScopeSchema = Schema.Union([
  Schema.Literal("all"),
  Schema.Literal("one"),
  Schema.Literal("multiple"),
]);

const CreateKeySchema = Schema.Struct({
  name: Schema.String,
  scope: ScopeSchema,
  regions: Schema.Array(Schema.String),
  postcodes: Schema.Boolean,
});

const UserSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
});

const SessionSchema = Schema.Struct({
  session: Schema.optional(
    Schema.Struct({
      user: Schema.optional(UserSchema),
    }),
  ),
});

const KeySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  start: Schema.optional(Schema.String),
  createdAt: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.String),
});

const KeyListSchema = Schema.Array(KeySchema);

const CreatedKeySchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
});

const UsageSchema = Schema.Struct({
  hour: Schema.Number,
  day: Schema.Number,
  week: Schema.Number,
  month: Schema.Number,
  year: Schema.Number,
});

const ErrorSchema = Schema.Struct({ error: Schema.String });

const proxyToApi = async (
  request: Request,
  apiUrl: string,
  method: string,
  path: string,
  body?: string,
): Promise<Response> => {
  const target = new URL(path, apiUrl);
  const headers = new Headers({ "content-type": "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const origin = request.headers.get("origin");
  if (origin) headers.set("origin", origin);
  const init: RequestInit = { method, headers, redirect: "manual" };
  if (body !== undefined) init.body = body;
  const response = await fetch(target.toString(), init);
  const outHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") outHeaders.set(key, value);
  });
  for (const cookieValue of response.headers.getSetCookie()) {
    outHeaders.append("set-cookie", cookieValue);
  }
  return new Response(response.body, {
    status: response.status,
    headers: outHeaders,
  });
};

export const authIntegration = new Elysia({ name: "auth" })
  .get(
    "/auth/session",
    async ({ request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "GET", "/api/auth/get-session");
    },
    {
      response: {
        200: Schema.toStandardSchemaV1(Schema.NullOr(SessionSchema)),
      },
    },
  )
  .post(
    "/auth/sign-in/email",
    async ({ body, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "POST", "/api/auth/sign-in/email", JSON.stringify(body));
    },
    { body: Schema.toStandardSchemaV1(SignInEmailSchema) },
  )
  .post(
    "/auth/sign-up/email",
    async ({ body, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "POST", "/api/auth/sign-up/email", JSON.stringify(body));
    },
    { body: Schema.toStandardSchemaV1(SignUpEmailSchema) },
  )
  .post("/auth/sign-out", async ({ request }) => {
    const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
    const apiUrl = env.API_URL ?? "http://localhost:8787";
    return proxyToApi(request, apiUrl, "POST", "/api/auth/sign-out");
  })
  .post(
    "/auth/sso/register",
    async ({ body, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "POST", "/api/auth/sso/register", JSON.stringify(body));
    },
    { body: Schema.toStandardSchemaV1(SsoRegisterSchema) },
  )
  .get(
    "/auth/keys",
    async ({ request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "GET", "/v1/keys");
    },
    {
      response: {
        200: Schema.toStandardSchemaV1(KeyListSchema),
        401: Schema.toStandardSchemaV1(ErrorSchema),
      },
    },
  )
  .post(
    "/auth/keys",
    async ({ body, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      return proxyToApi(request, apiUrl, "POST", "/v1/keys", JSON.stringify(body));
    },
    {
      body: Schema.toStandardSchemaV1(CreateKeySchema),
      response: {
        200: Schema.toStandardSchemaV1(CreatedKeySchema),
        401: Schema.toStandardSchemaV1(ErrorSchema),
        500: Schema.toStandardSchemaV1(ErrorSchema),
      },
    },
  )
  .get(
    "/auth/usage",
    async ({ query, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const apiUrl = env.API_URL ?? "http://localhost:8787";
      const keyId = query.keyId ?? "all";
      const separator = apiUrl.includes("?") ? "&" : "?";
      return proxyToApi(
        request,
        apiUrl,
        "GET",
        `/v1/usage${separator}keyId=${encodeURIComponent(keyId)}`,
      );
    },
    {
      response: {
        200: Schema.toStandardSchemaV1(UsageSchema),
      },
    },
  );
