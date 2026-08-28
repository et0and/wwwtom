import { Effect } from "effect";
import { makeAddressDb } from "./db";
import { makeSearchService } from "./search";
import { getAddressById, listAddresses, reverseGeocode, getMeta } from "./addresses";
import type { AddressFilters, Bbox } from "@tom/types/address";
import { getRequestEnv } from "@tom/utils/services/worker";

export const addressServicesFromRequest = async (request: Request) => {
  const env = getRequestEnv(request);

  const primary = env.ADDRESS_HYPERDRIVE?.connectionString ?? env.ADDRESS_DB ?? "";
  const replica =
    env.ADDRESS_HYPERDRIVE_REPLICA?.connectionString ?? env.ADDRESS_DB_REPLICA ?? primary;

  const db = makeAddressDb({
    primaryConnectionString: primary,
    replicaConnectionString: replica || primary,
  });

  const search = makeSearchService(db);

  return {
    db,
    search,
    getAddressById: (id: number) => getAddressById(db, id),
    listAddresses: (filters: AddressFilters) => listAddresses(db, filters),
    reverseGeocode: (lng: number, lat: number, limit: number) =>
      reverseGeocode(db, lng, lat, limit),
    getMeta: () => getMeta(db),
    searchAddresses: (query: string, limit: number, bbox?: Bbox) =>
      Effect.gen(function* () {
        const results = yield* search.search(query, limit);
        if (!bbox) return results;
        const [minLng, minLat, maxLng, maxLat] = bbox;
        return results.filter(
          (row) =>
            row.longitude >= minLng &&
            row.longitude <= maxLng &&
            row.latitude >= minLat &&
            row.latitude <= maxLat,
        );
      }),
  };
};

export type AddressServices = Awaited<ReturnType<typeof addressServicesFromRequest>>;
