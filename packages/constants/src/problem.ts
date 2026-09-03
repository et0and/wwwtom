/** RFC 9457 problem details media type (see rfc9457 §3). */
export const PROBLEM_JSON_MEDIA_TYPE = "application/problem+json";

/**
 * Problem type URIs under tom.so control (rfc9457 §3.1.1). `about:blank` is
 * the RFC's generic fallback for problems without a dedicated type and is the
 * builder's default.
 */
export const ProblemType = {
  AboutBlank: "about:blank",
  Validation: "https://errors.tom.so/validation",
  Unauthorized: "https://errors.tom.so/unauthorized",
  Forbidden: "https://errors.tom.so/forbidden",
  NotFound: "https://errors.tom.so/not-found",
  Upstream: "https://errors.tom.so/upstream",
} as const;

export type ProblemType = (typeof ProblemType)[keyof typeof ProblemType];
