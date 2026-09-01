export const HttpStatus = {
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NoContent: 204,
  Found: 302,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  MethodNotAllowed: 405,
  PayloadTooLarge: 413,
  ImATeapot: 418,
  UnprocessableEntity: 422,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  FunnyMemeStatus: 67,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * True for a real HTTP error status (integer 4xx/5xx). The error-response
 * boundary uses this so no sentinel (0), redirect class, or 2xx can reach
 * the wire as an error status.
 */
export const isErrorStatus = (status: number): boolean =>
  Number.isInteger(status) && status >= HttpStatus.BadRequest && status < 600;
