import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { AdapterError } from "../config/effect";
import { isTrustedWriteOrigin, type Tenant } from "../origins";

const refererOrigin = (referer: string): Effect.Effect<string, never> =>
  Effect.try(() => new URL(referer).origin).pipe(Effect.orElseSucceed(() => ""));

export type WriteOriginGateOptions = {
  readonly adapterOrigin: string;
  readonly allowLocalOrigins: boolean;
  readonly tenant: Tenant | undefined;
  readonly exemptSafeMethods: boolean;
  readonly message: string;
};

export const requireTrustedWriteOrigin = (
  request: Request,
  options: WriteOriginGateOptions,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    if (options.exemptSafeMethods && (request.method === "GET" || request.method === "HEAD"))
      return;
    const { adapterOrigin, allowLocalOrigins, tenant, message } = options;
    const direct = request.headers.get("origin");
    if (direct !== null) {
      if (!isTrustedWriteOrigin(direct, adapterOrigin, allowLocalOrigins, tenant)) {
        return yield* new AdapterError({ status: HttpStatus.Forbidden, message });
      }
      return;
    }
    const referer = request.headers.get("referer");
    if (referer === null) return;
    const origin = yield* refererOrigin(referer);
    if (!isTrustedWriteOrigin(origin, adapterOrigin, allowLocalOrigins, tenant)) {
      return yield* new AdapterError({ status: HttpStatus.Forbidden, message });
    }
  });
