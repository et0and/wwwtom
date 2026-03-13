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
  ImATeapot: 418,
  UnprocessableEntity: 422,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  FunnyMemeStatus: 67,
} as const;

export type HttpStatus = typeof HttpStatus[keyof typeof HttpStatus];