import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, toProblemResponse } from "@tom/utils/services/worker";

/** Constant-time comparison so token timing can't leak the shared secret. */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  const diff = Array.from(a, (char, index) => char.charCodeAt(0) ^ b.charCodeAt(index)).reduce(
    (acc, code) => acc | code,
    0,
  );
  return diff === 0;
};

/**
 * beforeHandle for routes only the adapter may call. Verifies the
 * {@link INTERNAL_TOKEN_HEADER} value against `INTERNAL_API_TOKEN` (from
 * TOM_SECRETS); fail-closed when the secret isn't configured.
 */
export const requireInternalTokenBeforeHandle = async ({ request }: { request: Request }) => {
  const env = await readCloudflareEnv(getRequestEnv(request));
  const expected = env.INTERNAL_API_TOKEN;
  const provided = request.headers.get(INTERNAL_TOKEN_HEADER);
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    Effect.runFork(
      Effect.logWarning("Internal auth failed", {
        path: request.url,
        hasToken: provided !== null,
      }),
    );
    return toProblemResponse(HttpStatus.Unauthorized, "Unauthorized", {
      type: ProblemType.Unauthorized,
    });
  }
  return;
};
