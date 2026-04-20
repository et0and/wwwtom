import { Schema } from "effect";
import { HttpStatus } from "@tom/constants";

export class InvalidRequestBody extends Schema.TaggedError<InvalidRequestBody>()(
  "InvalidRequestBody",
  {
    message: Schema.String,
  },
) {
  get httpStatus() {
    return HttpStatus.BadRequest;
  }
}

export class ProductNotFound extends Schema.TaggedError<ProductNotFound>()("ProductNotFound", {
  productSlug: Schema.String,
}) {
  get httpStatus() {
    return HttpStatus.NotFound;
  }
}

export class ProductNotPurchasable extends Schema.TaggedError<ProductNotPurchasable>()(
  "ProductNotPurchasable",
  {
    productSlug: Schema.String,
    reason: Schema.String,
  },
) {
  get httpStatus() {
    return HttpStatus.BadRequest;
  }
}

export class CheckoutConfigError extends Schema.TaggedError<CheckoutConfigError>()(
  "CheckoutConfigError",
  {
    message: Schema.String,
  },
) {
  get httpStatus() {
    return HttpStatus.InternalServerError;
  }
}

export class CheckoutSessionError extends Schema.TaggedError<CheckoutSessionError>()(
  "CheckoutSessionError",
  {
    cause: Schema.Defect,
  },
) {
  get httpStatus() {
    return HttpStatus.InternalServerError;
  }
}

export class StripeKeyNotConfigured extends Schema.TaggedError<StripeKeyNotConfigured>()(
  "StripeKeyNotConfigured",
  {
    productId: Schema.String,
  },
) {}

export class StripeSyncFailed extends Schema.TaggedError<StripeSyncFailed>()("StripeSyncFailed", {
  productId: Schema.String,
  cause: Schema.Defect,
}) {}

export const CheckoutError = Schema.Union(
  InvalidRequestBody,
  ProductNotFound,
  ProductNotPurchasable,
  CheckoutConfigError,
  CheckoutSessionError,
);
export type CheckoutError = typeof CheckoutError.Type;

export class WebhookSignatureInvalid extends Schema.TaggedError<WebhookSignatureInvalid>()(
  "WebhookSignatureInvalid",
  {
    message: Schema.String,
  },
) {
  get httpStatus() {
    return HttpStatus.BadRequest;
  }
}

export class WebhookProcessingError extends Schema.TaggedError<WebhookProcessingError>()(
  "WebhookProcessingError",
  {
    cause: Schema.Defect,
  },
) {
  get httpStatus() {
    return HttpStatus.InternalServerError;
  }
}

export const WebhookError = Schema.Union(WebhookSignatureInvalid, WebhookProcessingError);
export type WebhookError = typeof WebhookError.Type;

export const StripeSyncError = Schema.Union(StripeKeyNotConfigured, StripeSyncFailed);
export type StripeSyncError = typeof StripeSyncError.Type;
