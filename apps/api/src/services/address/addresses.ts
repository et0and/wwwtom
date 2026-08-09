import { Effect } from "effect";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { HttpError } from "@tom/types/errors";
import { runQuery, type AddressDbService } from "./db";
import { getRegion } from "./regions";

export const ADDRESS_API_VERSION = "1.1.0";

export type AddressRow = {
  readonly address_id: number;
  readonly full_address: string;
  readonly full_address_number: string;
  readonly full_road_name: string | null;
  readonly suburb_locality: string;
  readonly town_city: string;
  readonly territorial_authority: string;
  readonly postcode: string | null;
  readonly lng: number;
  readonly lat: number;
};

export interface Address {
  readonly addressId: number;
  readonly fullAddress: string;
  readonly fullAddressNumber: string;
  readonly fullAddressRoad: string | null;
  readonly suburb: string;
  readonly townCity: string;
  readonly territorialAuthority: string;
  readonly region: string | null;
  readonly postcode: string | null;
  readonly longitude: number;
  readonly latitude: number;
}

export const mapAddressRow = (row: AddressRow): Address => ({
  addressId: row.address_id,
  fullAddress: row.full_address,
  fullAddressNumber: row.full_address_number,
  fullAddressRoad: row.full_road_name,
  suburb: row.suburb_locality,
  townCity: row.town_city,
  territorialAuthority: row.territorial_authority,
  region: getRegion(row.territorial_authority),
  postcode: row.postcode ?? null,
  longitude: row.lng,
  latitude: row.lat,
});

export type Bbox = readonly [number, number, number, number];

export interface AddressFilters {
  readonly limit: number;
  readonly offset: number;
  readonly townCity?: string | undefined;
  readonly suburbLocality?: string | undefined;
  readonly roadName?: string | undefined;
  readonly bbox?: Bbox | undefined;
}

const SELECT_COLUMNS = sql`SELECT a.*, p.postcode
  FROM addresses a
  LEFT JOIN address_postcodes p ON p.address_id = a.address_id`;

export const getAddressById = (
  db: AddressDbService,
  id: number,
): Effect.Effect<Address | null, HttpError> =>
  Effect.gen(function* () {
    const database = yield* db.get;
    const rows = yield* runQuery<AddressRow>(
      database,
      sql`${SELECT_COLUMNS}
        WHERE a.address_id = ${id}
        LIMIT 1`,
      "getAddressById",
    );
    return rows[0] ? mapAddressRow(rows[0]) : null;
  });

export const listAddresses = (
  db: AddressDbService,
  filters: AddressFilters,
): Effect.Effect<readonly Address[], HttpError> =>
  Effect.gen(function* () {
    const database = yield* db.get;
    const conditions: SQL[] = [];
    if (filters.townCity) conditions.push(sql`a.town_city = ${filters.townCity}`);
    if (filters.suburbLocality) {
      conditions.push(sql`a.suburb_locality = ${filters.suburbLocality}`);
    }
    if (filters.roadName) {
      conditions.push(sql`a.full_road_name LIKE ${`%${filters.roadName}%`}`);
    }
    if (filters.bbox) {
      const [minLng, minLat, maxLng, maxLat] = filters.bbox;
      conditions.push(
        sql`a.lng BETWEEN ${minLng} AND ${maxLng} AND a.lat BETWEEN ${minLat} AND ${maxLat}`,
      );
    }
    const rows = yield* runQuery<AddressRow>(
      database,
      sql`${SELECT_COLUMNS}
        ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        LIMIT ${filters.limit} OFFSET ${filters.offset}`,
      "listAddresses",
    );
    return rows.map(mapAddressRow);
  });

export const reverseGeocode = (
  db: AddressDbService,
  lng: number,
  lat: number,
  limit: number,
): Effect.Effect<readonly Address[], HttpError> =>
  Effect.gen(function* () {
    const database = yield* db.get;
    const rows = yield* runQuery<AddressRow>(
      database,
      sql`${SELECT_COLUMNS}
        ORDER BY ABS(a.lng - ${lng}) + ABS(a.lat - ${lat})
        LIMIT ${limit}`,
      "reverseGeocode",
    );
    return rows.map(mapAddressRow);
  });

export interface Meta {
  readonly version: string;
  readonly totalAddresses: number;
  readonly lastUpdated: string;
}

export const getMeta = (db: AddressDbService): Effect.Effect<Meta, HttpError> =>
  Effect.gen(function* () {
    const database = yield* db.get;
    const rows = yield* runQuery<{ count: number; last_updated: string | null }>(
      database,
      sql`SELECT
        (SELECT COUNT(*) FROM addresses) AS count,
        (SELECT ingested_at FROM dataset_version ORDER BY ingested_at DESC LIMIT 1) AS last_updated`,
      "getMeta",
    );
    return {
      version: ADDRESS_API_VERSION,
      totalAddresses: rows[0]?.count ?? 0,
      lastUpdated: rows[0]?.last_updated ?? "unknown",
    };
  });
