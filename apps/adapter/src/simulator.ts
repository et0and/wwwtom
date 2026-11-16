import type { CloudflareEnv } from "@tom/utils/config";

/**
 * Simulator routing. When a request carries the `x-use-simulator` header and
 * the worker has a SIMULATOR_URL configured, the api URL is rewritten to the
 * simulator so the whole stack serves deterministic fixture data. are.na
 * reads ride the same swap: the adapter proxies them to the api, and the
 * simulator mounts the api's internal routes over its /v3 fixtures.
 * Production never sets SIMULATOR_URL, so the header alone cannot redirect
 * real traffic.
 */
export const SIMULATOR_HEADER = "x-use-simulator";

export const isSimulatorRequest = (request: Request): boolean => {
  const value = request.headers.get(SIMULATOR_HEADER);
  return value !== null && value !== "";
};

export const simulatorEnv = (env: CloudflareEnv, request: Request): CloudflareEnv => {
  const simulatorUrl = env.SIMULATOR_URL;
  if (!isSimulatorRequest(request) || !simulatorUrl) return env;
  // Drop the deployed api binding: the rewrite must win, not just the URL.
  const rest = { ...env };
  delete rest.API;
  return { ...rest, API_URL: simulatorUrl };
};
