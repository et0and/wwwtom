import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as fs from "fs";
import * as path from "path";

const pulumiConfig = new pulumi.Config("cloudflare");
const appConfig = new pulumi.Config("app");
const accountId = pulumiConfig.require("accountId");

function getWorkerContent(workerPath: string): string {
  const absolutePath = path.resolve(__dirname, workerPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Worker file not found at ${absolutePath}. Run 'bun build' first.`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const zoneId = appConfig.require("zoneId");
const domain = appConfig.require("domain");

const webRateLimitKv = new cloudflare.WorkersKvNamespace("web-rate-limit-kv", {
  accountId: accountId,
  title: "web-rate-limit-kv",
});

const webWorker = new cloudflare.WorkersScript("wwwtom", {
  accountId: accountId,
  scriptName: "wwwtom",
  content: getWorkerContent("../apps/web/.output/server/index.mjs"),
  mainModule: ".output/server/index.mjs",
  compatibilityDate: "2024-01-01",
  compatibilityFlags: ["nodejs_compat"],
  bindings: [
    {
      name: "TOM_RATE_LIMIT_KV",
      type: "kv_namespace",
      namespaceId: webRateLimitKv.id,
    },
    {
      name: "NODE_ENV",
      type: "plain_text",
      text: "production",
    },
  ],
});

const webRoute = new cloudflare.WorkersRoute("wwwtom-route", {
  zoneId: zoneId,
  pattern: `${domain}/*`,
  script: webWorker.scriptName,
});

const apiWorker = new cloudflare.WorkersScript("apitom", {
  accountId: accountId,
  scriptName: "apitom",
  content: getWorkerContent("../apps/api/src/index.ts"),
  mainModule: "src/index.ts",
  compatibilityDate: "2025-12-10",
  compatibilityFlags: ["nodejs_compat"],
  bindings: [
    {
      name: "NODE_ENV",
      type: "plain_text",
      text: "production",
    },
  ],
});

const apiRoute = new cloudflare.WorkersRoute("apitom-route", {
  zoneId: zoneId,
  pattern: `api.${domain}/*`,
  script: apiWorker.scriptName,
});

export const webWorkerName = webWorker.scriptName;
export const webWorkerId = webWorker.id;
export const webRoutePattern = webRoute.pattern;
export const webKvNamespaceId = webRateLimitKv.id;

export const apiWorkerName = apiWorker.scriptName;
export const apiWorkerId = apiWorker.id;
export const apiRoutePattern = apiRoute.pattern;
