import { Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String,
}) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {}

export class InvalidArgument extends Schema.TaggedError<InvalidArgument>()("InvalidArgument", {
  message: Schema.String,
}) {}

export class HttpError extends Schema.TaggedError<HttpError>()("HttpError", {
  message: Schema.String,
  status: Schema.Number,
  body: Schema.String,
}) {}

export type HttpMethodError = NotFound | InvalidArgument | Conflict | HttpError;

export const mapStatusToError = (status: number, body: string): HttpMethodError => {
  switch (status) {
    case HttpStatus.NotFound:
      return new NotFound({ message: body });
    case HttpStatus.Conflict:
      return new Conflict({ message: body });
    case HttpStatus.BadRequest:
      return new InvalidArgument({ message: body });
    default:
      return new HttpError({ message: body, status, body });
  }
};
