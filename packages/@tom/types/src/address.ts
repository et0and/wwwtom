import { Schema } from "effect";
import { AddressSchema, MetaSchema } from "@tom/schemas/address";

export type Address = Schema.Schema.Type<typeof AddressSchema>;

export type AddressFilters = {
  limit?: number;
  offset?: number;
  townCity?: string;
  suburbLocality?: string;
  roadName?: string;
  bbox?: readonly [number, number, number, number];
};

export type Bbox = readonly [number, number, number, number];

export type Meta = Schema.Schema.Type<typeof MetaSchema>;
