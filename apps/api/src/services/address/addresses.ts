import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import type { AddressDbService } from "./db";
import { SQL } from "./queries";
import { mapAddressRow, type RawAddressRow } from "./schema";
import type { Address, AddressFilters, Meta } from "@tom/types/address";

const dbError = (operation: string, cause: unknown): HttpError =>
  new HttpError({ message: `Database error during ${operation}`, status: 500, cause });

type CountRow = { count: number | string | bigint };
type MetaRow = { updated_at: string | null; ingested_at: string | null };

export const getAddressById = (
  db: AddressDbService,
  id: number,
): Effect.Effect<Address | null, HttpError> =>
  Effect.gen(function* () {
    const sql = yield* db.replica;
    const rows = yield* Effect.tryPromise({
      try: () => sql.unsafe<RawAddressRow>(SQL.selectAddressById, [id]),
      catch: (cause) => dbError("getAddressById", cause),
    });
    const first = rows[0];
    return first ? mapAddressRow(first) : null;
  });

export const listAddresses = (
  db: AddressDbService,
  filters: AddressFilters,
): Effect.Effect<readonly Address[], HttpError> =>
  Effect.gen(function* () {
    const sql = yield* db.replica;
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 1000);
    const offset = Math.max(filters.offset ?? 0, 0);

    let rows: readonly RawAddressRow[] = [];

    if (filters.townCity) {
      rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<RawAddressRow>(SQL.selectAddressesByTown, [filters.townCity, limit, offset]),
        catch: (cause) => dbError("listAddresses", cause),
      });
    } else if (filters.suburbLocality) {
      rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<RawAddressRow>(SQL.selectAddressesBySuburb, [
            filters.suburbLocality,
            limit,
            offset,
          ]),
        catch: (cause) => dbError("listAddresses", cause),
      });
    } else if (filters.roadName) {
      rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<RawAddressRow>(SQL.selectAddressesByRoad, [filters.roadName, limit, offset]),
        catch: (cause) => dbError("listAddresses", cause),
      });
    } else if (filters.bbox) {
      const bbox = filters.bbox;
      const [minLng, minLat, maxLng, maxLat] = bbox;
      rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<RawAddressRow>(SQL.selectAddressesByBbox, [
            minLng,
            maxLng,
            minLat,
            maxLat,
            limit,
            offset,
          ]),
        catch: (cause) => dbError("listAddresses", cause),
      });
    } else {
      rows = yield* Effect.tryPromise({
        try: () => sql.unsafe<RawAddressRow>(SQL.selectAddressesOrdered, [limit, offset]),
        catch: (cause) => dbError("listAddresses", cause),
      });
    }

    if (filters.bbox && !filters.townCity && !filters.suburbLocality && !filters.roadName) {
      return rows.map(mapAddressRow);
    }

    if (filters.bbox) {
      const bbox = filters.bbox;
      const [minLng, minLat, maxLng, maxLat] = bbox;
      const filtered = rows.filter(
        (row) =>
          Number(row.lng) >= minLng &&
          Number(row.lng) <= maxLng &&
          Number(row.lat) >= minLat &&
          Number(row.lat) <= maxLat,
      );
      return filtered.map(mapAddressRow);
    }

    return rows.map(mapAddressRow);
  });

export const reverseGeocode = (
  db: AddressDbService,
  lng: number,
  lat: number,
  limit: number,
): Effect.Effect<readonly Address[], HttpError> =>
  Effect.gen(function* () {
    const sql = yield* db.replica;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = yield* Effect.tryPromise({
      try: () => sql.unsafe<RawAddressRow>(SQL.selectReverseGeocode, [lng, lat, safeLimit]),
      catch: (cause) => dbError("reverseGeocode", cause),
    });
    return rows.map(mapAddressRow);
  });

let metaCache: { value: Meta; expiresAt: number } | null = null;
const META_CACHE_TTL_MS = 60_000;

export const getMeta = (db: AddressDbService): Effect.Effect<Meta, HttpError> =>
  Effect.gen(function* () {
    const now = Date.now();
    if (metaCache && metaCache.expiresAt > now) return metaCache.value;

    const sql = yield* db.replica;
    const version = yield* db.getDatasetVersion;
    const countRows = yield* Effect.tryPromise({
      try: () => sql.unsafe<CountRow>(SQL.countAddresses),
      catch: (cause) => dbError("getMeta", cause),
    });
    const total = Number(countRows[0]?.count ?? 0);
    const metaRows = yield* Effect.tryPromise({
      try: () => sql.unsafe<MetaRow>(SQL.selectMeta),
      catch: (): Promise<readonly MetaRow[]> => Promise.resolve([]),
    }).pipe(Effect.orElseSucceed((): readonly MetaRow[] => []));

    const lastUpdated =
      metaRows[0]?.ingested_at ?? metaRows[0]?.updated_at ?? new Date().toISOString();

    const value: Meta = {
      version: version ?? "unknown",
      totalAddresses: total,
      lastUpdated,
    };
    metaCache = { value, expiresAt: now + META_CACHE_TTL_MS };
    return value;
  });
