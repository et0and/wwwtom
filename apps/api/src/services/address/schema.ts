import { bigint, doublePrecision, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const addresses = pgTable("addresses", {
  addressId: bigint("address_id", { mode: "number" }).primaryKey(),
  sourceDataset: text("source_dataset"),
  changeId: integer("change_id"),
  fullAddressNumber: text("full_address_number"),
  fullAddress: text("full_address"),
  fullAddressAscii: text("full_address_ascii"),
  fullRoadName: text("full_road_name"),
  fullRoadNameAscii: text("full_road_name_ascii"),
  roadName: text("road_name"),
  roadNameAscii: text("road_name_ascii"),
  roadTypeName: text("road_type_name"),
  roadTypeNameAscii: text("road_type_name_ascii"),
  suburbLocality: text("suburb_locality"),
  suburbLocalityAscii: text("suburb_locality_ascii"),
  townCity: text("town_city"),
  townCityAscii: text("town_city_ascii"),
  territorialAuthority: text("territorial_authority"),
  unitType: text("unit_type"),
  unitTypeAscii: text("unit_type_ascii"),
  unitValue: text("unit_value"),
  levelType: text("level_type"),
  levelTypeAscii: text("level_type_ascii"),
  levelValue: text("level_value"),
  addressNumberPrefix: text("address_number_prefix"),
  addressNumber: integer("address_number"),
  addressNumberSuffix: text("address_number_suffix"),
  addressNumberHigh: integer("address_number_high"),
  roadNamePrefix: text("road_name_prefix"),
  roadSuffix: text("road_suffix"),
  waterName: text("water_name"),
  waterNameAscii: text("water_name_ascii"),
  waterBodyName: text("water_body_name"),
  waterBodyNameAscii: text("water_body_name_ascii"),
  addressClass: text("address_class"),
  addressClassAscii: text("address_class_ascii"),
  addressLifecycle: text("address_lifecycle"),
  gd2000Xcoord: doublePrecision("gd2000_xcoord"),
  gd2000Ycoord: doublePrecision("gd2000_ycoord"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  sourceVersion: text("source_version"),
});

export const datasetVersion = pgTable("dataset_version", {
  updateSequence: text("update_sequence").primaryKey(),
  updatedAt: text("updated_at"),
  ingestedAt: text("ingested_at"),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  runId: text("run_id").primaryKey(),
  updateSequence: text("update_sequence").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  totalFeatures: integer("total_features"),
  processedFeatures: integer("processed_features").default(0),
  errorCount: integer("error_count").default(0),
});

export const apiKeys = pgTable("api_keys", {
  keyHash: text("key_hash").primaryKey(),
  label: text("label"),
  enabled: integer("enabled").default(1),
  createdAt: text("created_at"),
});

export const addressPostcodes = pgTable("address_postcodes", {
  addressId: bigint("address_id", { mode: "number" }).primaryKey(),
  postcode: text("postcode").notNull(),
});

export const searchTerms = pgTable(
  "search_terms",
  {
    normalizedTerm: text("normalized_term").notNull(),
    canonicalTerm: text("canonical_term").notNull(),
    kind: text("kind").notNull(),
    frequency: integer("frequency").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.normalizedTerm, table.kind] })],
);

export const searchAliases = pgTable(
  "search_aliases",
  {
    alias: text("alias").notNull(),
    expansion: text("expansion").notNull(),
    priority: integer("priority").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.alias, table.expansion] })],
);

export const SEARCH_ALIASES: readonly { alias: string; expansion: string; priority: number }[] = [
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
    search_vector tsvector GENERATED ALWAYS AS (
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          coalesce(full_address, ''),
          coalesce(full_address_ascii, ''),
          coalesce(full_road_name, ''),
          coalesce(full_road_name_ascii, ''),
          coalesce(road_name, ''),
          coalesce(road_name_ascii, ''),
          coalesce(road_type_name, ''),
          coalesce(road_type_name_ascii, ''),
          coalesce(suburb_locality, ''),
          coalesce(suburb_locality_ascii, ''),
          coalesce(town_city, ''),
          coalesce(town_city_ascii, '')
        )
      )
    ) STORED
  )`,
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
