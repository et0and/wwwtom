// Turso Platform API — https://docs.turso.tech/api-reference
// Spec pinned at https://docs.turso.tech/api-reference/openapi.json
//
// Field names follow the API exactly. Group and Database responses use the
// documented PascalCase keys (`Name`, `DbId`, `Hostname`); request bodies use
// snake_case. Do not normalize these — the API is the wire.

import { Schema } from "effect";

/** Extensions to enable for new databases created in a group. */
export const GroupExtensionSchema = Schema.Literals([
  "vector",
  "crypto",
  "fuzzy",
  "math",
  "stats",
  "text",
  "unicode",
  "uuid",
  "regexp",
  "vec",
]);
export const GroupExtensionsSchema = Schema.Union([
  Schema.Literal("all"),
  Schema.Array(GroupExtensionSchema),
]);
export type GroupExtensions = Schema.Schema.Type<typeof GroupExtensionsSchema>;

// Locations

export const ListLocationsResponseSchema = Schema.Struct({
  locations: Schema.Record(Schema.String, Schema.String),
});
export type ListLocationsResponse = Schema.Schema.Type<typeof ListLocationsResponseSchema>;

// Group

export const GroupSchema = Schema.Struct({
  name: Schema.String,
  uuid: Schema.String,
  primary: Schema.String,
  delete_protection: Schema.Boolean,
  // `locations` and `version` are marked deprecated upstream; `primary` is the
  // current field. They stay optional so a response that omits them still decodes.
  locations: Schema.optional(Schema.Array(Schema.String)),
  version: Schema.optional(Schema.String),
});
export type Group = Schema.Schema.Type<typeof GroupSchema>;

export const NewGroupSchema = Schema.Struct({
  name: Schema.String,
  location: Schema.String,
  extensions: Schema.optional(GroupExtensionsSchema),
});
export type NewGroup = Schema.Schema.Type<typeof NewGroupSchema>;

export const GroupConfigurationSchema = Schema.Struct({
  delete_protection: Schema.Boolean,
});
export type GroupConfiguration = Schema.Schema.Type<typeof GroupConfigurationSchema>;

export const ListGroupsResponseSchema = Schema.Struct({
  groups: Schema.Array(GroupSchema),
});
export type ListGroupsResponse = Schema.Schema.Type<typeof ListGroupsResponseSchema>;

export const GetGroupResponseSchema = Schema.Struct({ group: GroupSchema });
export type GetGroupResponse = Schema.Schema.Type<typeof GetGroupResponseSchema>;

// Database

export const DatabaseParentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  branched_at: Schema.String,
});

export const DatabaseSchema = Schema.Struct({
  Name: Schema.String,
  DbId: Schema.String,
  Hostname: Schema.String,
  group: Schema.String,
  primaryRegion: Schema.String,
  block_reads: Schema.Boolean,
  block_writes: Schema.Boolean,
  delete_protection: Schema.Boolean,
  // Deprecated upstream in favour of the parent group's `primary`; optional so
  // a response that omits it still decodes.
  regions: Schema.optional(Schema.Array(Schema.String)),
  parent: Schema.optional(Schema.NullOr(DatabaseParentSchema)),
});
export type Database = Schema.Schema.Type<typeof DatabaseSchema>;

/** Only the fields a stack declares today. `seed` and `remote_encryption` are
 * one-shot create-time inputs with no read-back, so they stay out of props. */
export const CreateDatabaseSchema = Schema.Struct({
  name: Schema.String,
  group: Schema.String,
  size_limit: Schema.optional(Schema.String),
});
export type CreateDatabase = Schema.Schema.Type<typeof CreateDatabaseSchema>;

export const DatabaseConfigurationSchema = Schema.Struct({
  size_limit: Schema.optional(Schema.String),
  block_reads: Schema.optional(Schema.Boolean),
  block_writes: Schema.optional(Schema.Boolean),
  delete_protection: Schema.optional(Schema.Boolean),
  allowed_ips: Schema.optional(Schema.Array(Schema.String)),
  allowed_aws_vpc_ids: Schema.optional(Schema.Array(Schema.String)),
});
export type DatabaseConfiguration = Schema.Schema.Type<typeof DatabaseConfigurationSchema>;

export const ListDatabasesResponseSchema = Schema.Struct({
  databases: Schema.Array(DatabaseSchema),
});
export type ListDatabasesResponse = Schema.Schema.Type<typeof ListDatabasesResponseSchema>;

export const GetDatabaseResponseSchema = Schema.Struct({ database: DatabaseSchema });
export type GetDatabaseResponse = Schema.Schema.Type<typeof GetDatabaseResponseSchema>;

// SQL-engine tokens (control-plane credential vs SQL credential)

export const CreateDatabaseTokenResponseSchema = Schema.Struct({
  jwt: Schema.String,
});
export type CreateDatabaseTokenResponse = Schema.Schema.Type<
  typeof CreateDatabaseTokenResponseSchema
>;
