import { Schema } from "effect";
import { ListResponseSchema } from "./list";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CrmAssetId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("CrmAssetId"),
);
export type CrmAssetId = typeof CrmAssetId.Type;

export const CrmPhotoId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("CrmPhotoId"),
);
export type CrmPhotoId = typeof CrmPhotoId.Type;

export const CrmLocationId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("CrmLocationId"),
);
export type CrmLocationId = typeof CrmLocationId.Type;

export const CrmAssetStatusSchema = Schema.Literals([
  "available",
  "in-use",
  "maintenance",
  "retired",
]);
export type CrmAssetStatus = typeof CrmAssetStatusSchema.Type;

export const CrmAssetVersionSchema = Schema.Int.check(Schema.isGreaterThan(0));
export type CrmAssetVersion = typeof CrmAssetVersionSchema.Type;

export const CrmAssetVersionInputSchema = Schema.decodeTo(CrmAssetVersionSchema)(
  Schema.Union([Schema.Finite, Schema.FiniteFromString]),
);

const shortText = Schema.String.check(Schema.isMaxLength(200));
const descriptionText = Schema.String.check(Schema.isMaxLength(2000));
const locationText = Schema.String.check(Schema.isMaxLength(500));

export const CrmAssetInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  serialNumber: Schema.NullOr(shortText),
  description: Schema.NullOr(descriptionText),
  category: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  status: CrmAssetStatusSchema,
  location: Schema.NullOr(locationText),
});
export type CrmAssetInput = typeof CrmAssetInputSchema.Type;

export const CrmAssetUpdateSchema = Schema.Struct({
  ...CrmAssetInputSchema.fields,
  version: CrmAssetVersionSchema,
});
export type CrmAssetUpdate = typeof CrmAssetUpdateSchema.Type;

export const CrmLocationInputSchema = Schema.Struct({
  location: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  note: Schema.NullOr(Schema.String.check(Schema.isMaxLength(1000))),
});
export type CrmLocationInput = typeof CrmLocationInputSchema.Type;

export const CrmLocationUpdateSchema = Schema.Struct({
  ...CrmLocationInputSchema.fields,
  version: CrmAssetVersionSchema,
});
export type CrmLocationUpdate = typeof CrmLocationUpdateSchema.Type;

const PagingNumberInput = Schema.Union([Schema.Finite, Schema.FiniteFromString]);
const PagingNumber = Schema.decodeTo(Schema.Int)(PagingNumberInput);

export const CrmPagingSchema = Schema.Struct({
  page: Schema.optional(PagingNumber),
  pageSize: Schema.optional(PagingNumber),
});
export type CrmPaging = typeof CrmPagingSchema.Type;

export const CrmPhotoSchema = Schema.Struct({
  id: CrmPhotoId,
  originalName: Schema.String,
  mime: Schema.String,
  byteSize: Schema.Finite,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  filePath: Schema.String,
  createdAt: Schema.String,
});
export type CrmPhoto = typeof CrmPhotoSchema.Type;

export const CrmLocationSchema = Schema.Struct({
  id: CrmLocationId,
  location: Schema.String,
  note: Schema.NullOr(Schema.String),
  loggedBy: Schema.String,
  createdAt: Schema.String,
});
export type CrmLocation = typeof CrmLocationSchema.Type;

export const CrmAssetSchema = Schema.Struct({
  id: CrmAssetId,
  name: Schema.String,
  serialNumber: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  category: Schema.String,
  status: CrmAssetStatusSchema,
  location: Schema.NullOr(Schema.String),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  version: CrmAssetVersionSchema,
  qrPath: Schema.String,
  photos: Schema.Array(CrmPhotoSchema),
  locations: Schema.Array(CrmLocationSchema),
  createdBy: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CrmAsset = typeof CrmAssetSchema.Type;

export const CrmAssetListResponseSchema = ListResponseSchema(CrmAssetSchema);
export type CrmAssetListResponse = typeof CrmAssetListResponseSchema.Type;
