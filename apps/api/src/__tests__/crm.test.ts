import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { CrmAssetInput } from "@tom/schemas/crm";
import type { CmsD1Binding, CmsD1Statement, CmsR2Binding } from "@tom/utils/services/config";
import {
  addAssetPhotos,
  createAsset,
  decodeCrmAssetInput,
  listAssets,
  decodeCrmLocationInput,
  logAssetLocation,
  sha256Digest,
  updateAsset,
  type CrmPhotoUpload,
} from "../services/crm";

type Row = Record<string, string | number | null>;

type Store = {
  readonly assets: Array<Row>;
  readonly photos: Array<Row>;
  readonly locations: Array<Row>;
  readonly objects: Map<string, ArrayBuffer>;
  readonly puts: Array<{ readonly key: string; readonly sha256: ArrayBuffer | string | undefined }>;
};

const emptyStore = (): Store => ({
  assets: [],
  photos: [],
  locations: [],
  objects: new Map(),
  puts: [],
});

const insertPhotoRowsFor = (
  store: Store,
  sql: string,
  values: ReadonlyArray<string | number | null>,
): Array<Row> => {
  if (sql.includes("SELECT ?, id")) {
    const asset = store.assets.find((row) => row["id"] === values[7]);
    if (
      asset !== undefined &&
      asset["version"] === Number(values[8]) &&
      asset["mutationId"] === values[9]
    ) {
      store.photos.push({
        id: String(values[0]),
        asset_id: String(values[7]),
        objectKey: String(values[1]),
        originalName: String(values[2]),
        mime: String(values[3]),
        byteSize: Number(values[4]),
        sha256: String(values[5]),
        createdAt: String(values[6]),
      });
    }
    return [];
  }
  store.photos.push({
    id: String(values[0]),
    asset_id: String(values[1]),
    objectKey: String(values[2]),
    originalName: String(values[3]),
    mime: String(values[4]),
    byteSize: Number(values[5]),
    sha256: String(values[6]),
    createdAt: String(values[7]),
  });
  return [];
};

const mutationRowsFor = (
  store: Store,
  sql: string,
  values: ReadonlyArray<string | number | null>,
): Array<Row> => {
  if (sql.startsWith("INSERT INTO crm_assets")) {
    store.assets.push({
      id: String(values[0]),
      name: String(values[1]),
      serialNumber: values[2],
      description: values[3],
      category: String(values[4]),
      status: String(values[5]),
      location: values[6],
      hash: String(values[7]),
      version: 1,
      mutationId: null,
      createdBy: String(values[8]),
      createdAt: String(values[9]),
      updatedAt: String(values[10]),
    });
    return [];
  }
  if (sql.includes("INSERT INTO crm_asset_photos")) {
    return insertPhotoRowsFor(store, sql, values);
  }
  if (sql.includes("INSERT INTO crm_asset_locations") && sql.includes("SELECT ?, id")) {
    const asset = store.assets.find((row) => row["id"] === values[5]);
    if (
      asset !== undefined &&
      asset["version"] === Number(values[6]) &&
      asset["hash"] === values[7] &&
      asset["mutationId"] === values[8] &&
      asset["updatedAt"] === values[9]
    ) {
      store.locations.push({
        id: String(values[0]),
        asset_id: String(values[5]),
        location: String(values[1]),
        note: values[2],
        loggedBy: String(values[3]),
        createdAt: String(values[4]),
      });
    }
    return [];
  }
  if (sql.startsWith("INSERT INTO crm_asset_locations")) {
    store.locations.push({
      id: String(values[0]),
      asset_id: String(values[1]),
      location: String(values[2]),
      note: values[3],
      loggedBy: String(values[4]),
      createdAt: String(values[5]),
    });
    return [];
  }
  if (sql.startsWith("UPDATE crm_assets SET hash = ?")) {
    const asset = store.assets.find((row) => row["id"] === values[3]);
    if (asset !== undefined) {
      asset["hash"] = String(values[0]);
      asset["version"] = Number(asset["version"] ?? 1) + 1;
      asset["mutationId"] = String(values[1]);
      asset["updatedAt"] = String(values[2]);
    }
    return [];
  }
  if (sql.startsWith("UPDATE crm_assets SET name = ?")) {
    const asset = store.assets.find((row) => row["id"] === values[9]);
    if (asset !== undefined) {
      asset["name"] = String(values[0]);
      asset["serialNumber"] = values[1];
      asset["description"] = values[2];
      asset["category"] = String(values[3]);
      asset["status"] = String(values[4]);
      asset["location"] = values[5];
      asset["hash"] = String(values[6]);
      asset["version"] = Number(asset["version"] ?? 1) + 1;
      asset["mutationId"] = String(values[7]);
      asset["updatedAt"] = String(values[8]);
    }
    return [];
  }
  return [];
};

const rowsFor = (
  store: Store,
  sql: string,
  values: ReadonlyArray<string | number | null>,
): Array<Row> => {
  if (sql.startsWith("INSERT") || sql.startsWith("UPDATE")) {
    return mutationRowsFor(store, sql, values);
  }
  if (sql.includes("FROM crm_asset_photos WHERE id = ? AND asset_id = ?")) {
    return store.photos
      .filter((row) => row["id"] === values[0] && row["asset_id"] === values[1])
      .map((row) => ({ ...row, assetId: String(row["asset_id"]) }));
  }
  if (sql.includes("FROM crm_asset_photos WHERE asset_id IN")) {
    return store.photos
      .filter((row) => values.includes(String(row["asset_id"])))
      .map((row) => ({ ...row, assetId: String(row["asset_id"]) }));
  }
  if (sql.includes("FROM crm_asset_photos WHERE asset_id = ?")) {
    return store.photos
      .filter((row) => row["asset_id"] === values[0])
      .map((row) => ({ ...row, assetId: String(row["asset_id"]) }));
  }
  if (sql.includes("FROM crm_asset_locations WHERE asset_id IN")) {
    return store.locations
      .filter((row) => values.includes(String(row["asset_id"])))
      .map((row) => ({ ...row, assetId: String(row["asset_id"]) }));
  }
  if (sql.includes("FROM crm_asset_locations WHERE asset_id = ?")) {
    return store.locations
      .filter((row) => row["asset_id"] === values[0])
      .map((row) => ({ ...row, assetId: String(row["asset_id"]) }));
  }
  if (sql.includes("FROM crm_assets WHERE id = ?")) {
    return store.assets.filter((row) => row["id"] === values[0]);
  }
  if (sql.startsWith("SELECT COUNT(*) AS total FROM crm_assets")) {
    return [{ total: store.assets.length }];
  }
  if (sql.includes("FROM crm_assets ORDER BY")) {
    const offset = Number(values[1] ?? 0);
    const limit = Number(values[0] ?? store.assets.length);
    return store.assets.slice(offset, offset + limit);
  }
  return [];
};

const fakeDb = (store: Store): CmsD1Binding => {
  const queries = new WeakMap<
    CmsD1Statement,
    { readonly sql: string; readonly values: ReadonlyArray<string | number | null> }
  >();
  return {
    prepare: (sql: string): CmsD1Statement => {
      const makeStatement = (values: ReadonlyArray<string | number | null>): CmsD1Statement => {
        const statement: CmsD1Statement = {
          bind: (...nextValues: ReadonlyArray<string | number | null>) => makeStatement(nextValues),
          first: async <T>() => (rowsFor(store, sql, values)[0] ?? null) as T | null,
          all: async <T>() => ({ results: rowsFor(store, sql, values) as Array<T> }),
          run: async () => {
            rowsFor(store, sql, values);
            return { success: true };
          },
        };
        queries.set(statement, { sql, values });
        return statement;
      };
      return makeStatement([]);
    },
    batch: async (statements) => {
      statements.forEach((statement) => {
        const query = queries.get(statement);
        if (query !== undefined) rowsFor(store, query.sql, query.values);
      });
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
    exec: () => Promise.resolve({}),
  };
};

const fakeR2 = (store: Store): CmsR2Binding => ({
  put: async (key, value, options) => {
    const bytes =
      value instanceof ArrayBuffer
        ? value
        : value instanceof Uint8Array
          ? (value.buffer as ArrayBuffer)
          : (new TextEncoder().encode(value).buffer as ArrayBuffer);
    store.objects.set(key, bytes);
    store.puts.push({ key, sha256: options?.sha256 });
    return { key };
  },
  get: async (key) => {
    const bytes = store.objects.get(key);
    return bytes === undefined
      ? null
      : { key, size: bytes.byteLength, arrayBuffer: async () => bytes };
  },
  delete: async (key) => {
    store.objects.delete(key);
  },
});

const input = (overrides: Partial<CrmAssetInput> = {}): CrmAssetInput => ({
  name: "Camera",
  serialNumber: "CAM-001",
  description: "Mirrorless camera",
  category: "Gear",
  status: "available",
  location: "Shelf A",
  ...overrides,
});

const photo = async (name: string): Promise<CrmPhotoUpload> => {
  const bytes = new TextEncoder().encode(`image:${name}`).buffer as ArrayBuffer;
  const digest = await Effect.runPromise(sha256Digest(bytes, "test"));
  return { name, mime: "image/png", bytes, digest: digest.digest, sha256: digest.sha256 };
};

describe("CRM service", () => {
  it("maps malformed input to a client error", async () => {
    const assetError = await Effect.runPromise(
      Effect.flip(decodeCrmAssetInput({}, "create_asset")),
    );
    const locationError = await Effect.runPromise(
      Effect.flip(decodeCrmLocationInput({}, "log_location")),
    );

    expect(assetError.status).toBe(400);
    expect(locationError.status).toBe(400);
  });

  it("normalizes JSON input and rejects whitespace-only required values", async () => {
    const normalized = await Effect.runPromise(
      decodeCrmAssetInput(
        {
          name: "  Camera  ",
          serialNumber: "  CAM-001  ",
          description: "  ",
          category: "  Gear  ",
          status: "available",
          location: "  Shelf A  ",
        },
        "update_asset",
      ),
    );
    const invalid = await Effect.runPromise(
      Effect.flip(
        decodeCrmAssetInput(
          {
            name: "   ",
            serialNumber: null,
            description: null,
            category: "Gear",
            status: "available",
            location: null,
          },
          "update_asset",
        ),
      ),
    );

    expect(normalized).toEqual({
      name: "Camera",
      serialNumber: "CAM-001",
      description: null,
      category: "Gear",
      status: "available",
      location: "Shelf A",
    });
    expect(invalid.status).toBe(400);
  });

  it("does not add an empty history row when clearing a location", async () => {
    const store = emptyStore();
    const created = await Effect.runPromise(
      createAsset(fakeDb(store), fakeR2(store), input(), [], "admin@example.com"),
    );
    const updated = await Effect.runPromise(
      updateAsset(
        fakeDb(store),
        created.id,
        input({ location: null }),
        created.version,
        "admin@example.com",
      ),
    );

    expect(updated.location).toBeNull();
    expect(updated.locations).toHaveLength(1);
  });

  it("rejects stale asset versions", async () => {
    const store = emptyStore();
    const created = await Effect.runPromise(
      createAsset(fakeDb(store), fakeR2(store), input(), [], "admin@example.com"),
    );
    const error = await Effect.runPromise(
      Effect.flip(
        updateAsset(
          fakeDb(store),
          created.id,
          input({ name: "Stale edit" }),
          created.version - 1,
          "admin@example.com",
        ),
      ),
    );

    expect(error.status).toBe(409);
    expect(store.assets[0]?.name).toBe("Camera");
  });

  it("hashes bytes with SHA-256", async () => {
    const bytes = new TextEncoder().encode("mono").buffer as ArrayBuffer;
    const result = await Effect.runPromise(sha256Digest(bytes, "test"));
    expect(result.sha256).toBe("d7de34b17b4691aa77ab8c17afdd440b004bc87d5d9ab991a8296d032fadb867");
  });

  it("creates an asset, stores photos, and records a location", async () => {
    const store = emptyStore();
    const result = await Effect.runPromise(
      createAsset(
        fakeDb(store),
        fakeR2(store),
        input(),
        [await photo("front.png")],
        "admin@example.com",
      ),
    );

    expect(result.name).toBe("Camera");
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.locations[0]?.location).toBe("Shelf A");
    expect(store.objects.size).toBe(1);
    expect(store.puts[0]?.sha256).toBeInstanceOf(ArrayBuffer);
  });

  it("adds photos and updates the asset hash", async () => {
    const store = emptyStore();
    const created = await Effect.runPromise(
      createAsset(fakeDb(store), fakeR2(store), input(), [], "admin@example.com"),
    );
    const updated = await Effect.runPromise(
      addAssetPhotos(
        fakeDb(store),
        fakeR2(store),
        created.id,
        [await photo("back.png")],
        created.version,
        "admin@example.com",
      ),
    );

    expect(updated.photos).toHaveLength(1);
    expect(updated.hash).not.toBe(created.hash);
    expect(store.objects.size).toBe(1);
  });

  it("lists assets with their related records", async () => {
    const store = emptyStore();
    const first = await Effect.runPromise(
      createAsset(fakeDb(store), fakeR2(store), input(), [await photo("front.png")], "one"),
    );
    const second = await Effect.runPromise(
      createAsset(
        fakeDb(store),
        fakeR2(store),
        input({ name: "Lens", serialNumber: "LEN-001", location: "Shelf B" }),
        [],
        "two",
      ),
    );
    const result = await Effect.runPromise(listAssets(fakeDb(store)));

    expect(result.totalDocs).toBe(2);
    expect(result.docs.find((asset) => asset.id === first.id)?.photos).toHaveLength(1);
    const secondPage = await Effect.runPromise(listAssets(fakeDb(store), { page: 2, pageSize: 1 }));
    expect(secondPage.docs).toHaveLength(1);
    expect(secondPage.totalDocs).toBe(2);
    expect(secondPage.hasPrevPage).toBe(true);
    expect(secondPage.hasNextPage).toBe(false);
    expect(result.docs.find((asset) => asset.id === second.id)?.locations[0]?.location).toBe(
      "Shelf B",
    );
  });

  it("updates the hash and location history when a location is logged", async () => {
    const store = emptyStore();
    const created = await Effect.runPromise(
      createAsset(fakeDb(store), fakeR2(store), input(), [], "admin@example.com"),
    );
    const updated = await Effect.runPromise(
      logAssetLocation(
        fakeDb(store),
        created.id,
        { location: "Shelf B", note: "Moved" },
        created.version,
        "admin@example.com",
      ),
    );

    expect(updated.location).toBe("Shelf B");
    expect(updated.hash).not.toBe(created.hash);
    expect(updated.locations).toHaveLength(2);
  });
});
