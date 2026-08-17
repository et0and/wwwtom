import type { CloudflareEnv } from "@tom/utils/services/config";

/**
 * Simulator routing. When a request carries the `x-use-simulator` header and
 * the worker has a SIMULATOR_URL configured, upstream service URLs
 * (payload/arena/polar/api) are rewritten to the simulator so the whole stack
 * serves deterministic fixture data. Production never sets SIMULATOR_URL, so
 * the header alone cannot redirect real traffic.
 */
export const SIMULATOR_HEADER = "x-use-simulator";

export const isSimulatorRequest = (request: Request): boolean => {
  const value = request.headers.get(SIMULATOR_HEADER);
  return value !== null && value !== "";
};

export const simulatorEnv = (env: CloudflareEnv, request: Request): CloudflareEnv => {
  const simulatorUrl = env.SIMULATOR_URL;
  if (!isSimulatorRequest(request) || !simulatorUrl) return env;
  return {
    ...env,
    ARENA_API_URL: simulatorUrl,
    POLAR_API_URL: simulatorUrl,
    PAYLOAD_URL: simulatorUrl,
    API_URL: simulatorUrl,
  };
};
