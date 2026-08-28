import { Schema } from "effect";

export const SEARCH_ALIASES: readonly {
  alias: string;
  expansion: string;
  priority: number;
}[] = [
  { alias: "apt", expansion: "apartment", priority: 100 },
  { alias: "ave", expansion: "avenue", priority: 100 },
  { alias: "blvd", expansion: "boulevard", priority: 100 },
  { alias: "cl", expansion: "close", priority: 100 },
  { alias: "cres", expansion: "crescent", priority: 100 },
  { alias: "ctr", expansion: "centre", priority: 100 },
  { alias: "dr", expansion: "drive", priority: 100 },
  { alias: "hwy", expansion: "highway", priority: 100 },
  { alias: "ln", expansion: "lane", priority: 100 },
  { alias: "mtrwy", expansion: "motorway", priority: 100 },
  { alias: "mt", expansion: "mount", priority: 100 },
  { alias: "pde", expansion: "parade", priority: 100 },
  { alias: "pl", expansion: "place", priority: 100 },
  { alias: "rd", expansion: "road", priority: 100 },
  { alias: "sq", expansion: "square", priority: 100 },
  { alias: "st", expansion: "street", priority: 90 },
  { alias: "st", expansion: "saint", priority: 70 },
  { alias: "tce", expansion: "terrace", priority: 100 },
  { alias: "unit", expansion: "apartment", priority: 50 },
];

export const ADDRESS_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS addresses (
    address_id BIGINT PRIMARY KEY,
    source_dataset TEXT,
    change_id INTEGER,
    full_address_number TEXT,
    full_address TEXT,
    full_address_ascii TEXT,
    full_road_name TEXT,
    full_road_name_ascii TEXT,
    road_name TEXT,
    road_name_ascii TEXT,
    road_type_name TEXT,
    road_type_name_ascii TEXT,
    suburb_locality TEXT,
    suburb_locality_ascii TEXT,
    town_city TEXT,
    town_city_ascii TEXT,
    territorial_authority TEXT,
    unit_type TEXT,
    unit_type_ascii TEXT,
    unit_value TEXT,
    level_type TEXT,
    level_type_ascii TEXT,
    level_value TEXT,
    address_number_prefix TEXT,
    address_number INTEGER,
    address_number_suffix TEXT,
    address_number_high INTEGER,
    road_name_prefix TEXT,
    road_suffix TEXT,
    water_name TEXT,
    water_name_ascii TEXT,
    water_body_name TEXT,
    water_body_name_ascii TEXT,
    address_class TEXT,
    address_class_ascii TEXT,
    address_lifecycle TEXT,
    gd2000_xcoord DOUBLE PRECISION,
    gd2000_ycoord DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    source_version TEXT,
    search_vector tsvector
  )`,
  `CREATE OR REPLACE FUNCTION addresses_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'simple',
    concat_ws(
      ' ',
      coalesce(NEW.full_address, ''),
      coalesce(NEW.full_address_ascii, ''),
      coalesce(NEW.full_road_name, ''),
      coalesce(NEW.full_road_name_ascii, ''),
      coalesce(NEW.road_name, ''),
      coalesce(NEW.road_name_ascii, ''),
      coalesce(NEW.road_type_name, ''),
      coalesce(NEW.road_type_name_ascii, ''),
      coalesce(NEW.suburb_locality, ''),
      coalesce(NEW.suburb_locality_ascii, ''),
      coalesce(NEW.town_city, ''),
      coalesce(NEW.town_city_ascii, '')
    )
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql`,
  "DROP TRIGGER IF EXISTS addresses_search_vector_trigger ON addresses",
  "CREATE TRIGGER addresses_search_vector_trigger BEFORE INSERT OR UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION addresses_search_vector_update()",
  "CREATE INDEX IF NOT EXISTS addresses_search_idx ON addresses USING GIN (search_vector)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_town_city ON addresses (town_city)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_suburb_locality ON addresses (suburb_locality)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_road_name ON addresses (road_name)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_lat ON addresses (lat)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_lng ON addresses (lng)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_source_version ON addresses (source_version)",
  `CREATE TABLE IF NOT EXISTS dataset_version (
    update_sequence TEXT PRIMARY KEY,
    updated_at TEXT,
    ingested_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_runs (
    run_id TEXT PRIMARY KEY,
    update_sequence TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    total_features INTEGER,
    processed_features INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    key_hash TEXT PRIMARY KEY,
    label TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS address_postcodes (
    address_id BIGINT PRIMARY KEY,
    postcode TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_postcodes_postcode ON address_postcodes (postcode)",
  `CREATE TABLE IF NOT EXISTS search_terms (
    normalized_term TEXT NOT NULL,
    canonical_term TEXT NOT NULL,
    kind TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (normalized_term, kind)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_search_terms_kind_frequency ON search_terms (kind, frequency DESC)",
  `CREATE TABLE IF NOT EXISTS search_aliases (
    alias TEXT NOT NULL,
    expansion TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (alias, expansion)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_search_aliases_alias_priority ON search_aliases (alias, priority DESC)",
];

export const AliasRowSchema = Schema.Struct({ expansion: Schema.String });
export const TermRowSchema = Schema.Struct({
  normalized_term: Schema.String,
  frequency: Schema.Int,
});
export const CountRowSchema = Schema.Struct({
  search_term_count: Schema.Number,
  address_count: Schema.Number,
});
export const AddressRowSchema = Schema.Struct({
  address_id: Schema.Number,
  full_address: Schema.String,
  full_address_number: Schema.String,
  full_road_name: Schema.NullOr(Schema.String),
  suburb_locality: Schema.String,
  town_city: Schema.String,
  territorial_authority: Schema.String,
  lat: Schema.Number,
  lng: Schema.Number,
  postcode: Schema.optional(Schema.NullOr(Schema.String)),
  source_version: Schema.optional(Schema.NullOr(Schema.String)),
  region: Schema.optional(Schema.NullOr(Schema.String)),
});

export type AddressRow = Schema.Schema.Type<typeof AddressRowSchema>;

const toNumber = (value: string | number | bigint): number => Number(value);

export const mapAddressRow = (row: AddressRow) => ({
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- postgres returns BIGINT as string at runtime; Schema types narrow to number, so coerce boundary value
  addressId: toNumber(row.address_id as unknown as string | number | bigint),
  fullAddress: row.full_address,
  fullAddressNumber: row.full_address_number,
  fullAddressRoad: row.full_road_name,
  suburb: row.suburb_locality,
  townCity: row.town_city,
  territorialAuthority: row.territorial_authority,
  region: row.region ?? null,
  postcode: row.postcode ?? null,
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- lat/lng are DOUBLE PRECISION but driver may return string
  longitude: toNumber(row.lng as unknown as string | number | bigint),
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- same
  latitude: toNumber(row.lat as unknown as string | number | bigint),
});
