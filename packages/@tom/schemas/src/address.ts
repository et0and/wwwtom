import { Schema } from "effect";

export const AddressSchema = Schema.Struct({
  addressId: Schema.Number,
  fullAddress: Schema.String,
  fullAddressNumber: Schema.String,
  fullAddressRoad: Schema.NullOr(Schema.String),
  suburb: Schema.String,
  townCity: Schema.String,
  territorialAuthority: Schema.String,
  region: Schema.NullOr(Schema.String),
  postcode: Schema.NullOr(Schema.String),
  longitude: Schema.Number,
  latitude: Schema.Number,
});

export const AddressListSchema = Schema.Array(AddressSchema);

export const MetaSchema = Schema.Struct({
  version: Schema.String,
  totalAddresses: Schema.Number,
  lastUpdated: Schema.String,
});

export const AddressSearchQuerySchema = Schema.Struct({
  q: Schema.String,
  limit: Schema.optional(Schema.String),
  bbox: Schema.optional(Schema.String),
});

export const AddressListQuerySchema = Schema.Struct({
  limit: Schema.optional(Schema.String),
  offset: Schema.optional(Schema.String),
  town_city: Schema.optional(Schema.String),
  suburb_locality: Schema.optional(Schema.String),
  road_name: Schema.optional(Schema.String),
  bbox: Schema.optional(Schema.String),
});

export const ReverseQuerySchema = Schema.Struct({
  lat: Schema.String,
  lng: Schema.String,
  limit: Schema.optional(Schema.String),
});

export const ParamsSchema = Schema.Struct({ id: Schema.String });
