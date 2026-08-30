import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import worker, {
  ARTIFACT_TTL_SECONDS,
  MAX_ARTIFACT_BYTES,
  type ArtifactMetadata,
  type TurboCacheEnv,
} from "../index";

const TOKEN = "test-turbo-token-0123456789abcdef";
const SIGNATURE_KEY = "test-turbo-signature-key-0123456789abcdef";
// A typical 64-char turbo task hash.
const HASH = "9f86d081884c7d659a2feaa0c55ad01edfb2bcd5a2e0a5b9d3b1f6a5c8d1a2c3";
const BASE = "https://turbo.infra.tom.so";

/** Tag Turbo's client computes: base64 HMAC-SHA256 over hash || teamId || body. */
const tagFor = (hash: string, teamId: string, body: Uint8Array, key: string): string =>
  createHmac("sha256", key).update(hash).update(teamId).update(body).digest("base64");

type StoredArtifact = { value: Uint8Array; metadata: ArtifactMetadata | null };

/** In-memory Cloudflare KV stand-in recording put options for assertions. */
class MemoryKv {
  readonly entries = new Map<string, StoredArtifact>();
  readonly putCalls: Array<{ key: string; bytes: number; expirationTtl: number | null }> = [];

  async put(
    key: string,
    value: ArrayBuffer,
    options?: { expirationTtl?: number; metadata?: unknown },
  ): Promise<void> {
    const body = new Uint8Array(value);
    this.entries.set(key, {
      value: body,
      metadata: (options?.metadata as ArtifactMetadata | undefined) ?? null,
    });
    this.putCalls.push({
      key,
      bytes: body.byteLength,
      expirationTtl: options?.expirationTtl ?? null,
    });
  }

  async getWithMetadata(
    key: string,
    type: "arrayBuffer",
  ): Promise<{ value: ArrayBuffer | null; metadata: ArtifactMetadata | null }> {
    const entry = this.entries.get(key);
    if (entry === undefined || type !== "arrayBuffer") return { value: null, metadata: null };
    const value = new ArrayBuffer(entry.value.byteLength);
    new Uint8Array(value).set(entry.value);
    return { value, metadata: entry.metadata };
  }
}

const setup = (signatureKey?: string) => {
  const kv = new MemoryKv();
  const env: TurboCacheEnv = {
    TURBO_CACHE_KV: kv,
    TURBO_CACHE_TOKEN: TOKEN,
    NODE_ENV: "test",
  };
  if (signatureKey !== undefined) {
    Object.assign(env, { TURBO_CACHE_SIGNATURE_KEY: signatureKey });
  }
  return { kv, env };
};

const request = (path: string, init?: RequestInit): Request => new Request(`${BASE}${path}`, init);

const authorizedHeaders = (extra?: Record<string, string>): HeadersInit => ({
  Authorization: `Bearer ${TOKEN}`,
  ...extra,
});

describe("Turborepo remote cache on KV", () => {
  it("round-trips an artifact and its metadata headers", async () => {
    const { kv, env } = setup();
    const body = new Uint8Array([1, 2, 3, 4]);

    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({
        "Content-Type": "application/octet-stream",
        "x-artifact-duration": "1234",
        "x-artifact-tag": "dGhlLXRyZWFzdXJl",
        "x-artifact-sha": "abc123",
        "x-artifact-dirty-hash": "dirty",
      }),
      body,
    });
    expect((await worker.fetch(put, env)).status).toBe(200);

    expect(kv.entries.size).toBe(1);
    // Artifacts carry a TTL so stale branch caches expire.
    expect(kv.putCalls[0]).toEqual({
      key: HASH,
      bytes: 4,
      expirationTtl: ARTIFACT_TTL_SECONDS,
    });

    const get = request(`/v8/artifacts/${HASH}`, {
      headers: authorizedHeaders(),
    });
    const response = await worker.fetch(get, env);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(response.headers.get("x-artifact-duration")).toBe("1234");
    expect(response.headers.get("x-artifact-tag")).toBe("dGhlLXRyZWFzdXJl");
    expect(response.headers.get("x-artifact-sha")).toBe("abc123");
    expect(response.headers.get("x-artifact-dirty-hash")).toBe("dirty");
  });

  it("stores and serves an artifact without metadata headers", async () => {
    const { env } = setup();
    const body = new Uint8Array([9, 8, 7]);

    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({ "Content-Type": "application/octet-stream" }),
      body,
    });
    expect((await worker.fetch(put, env)).status).toBe(200);

    const response = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { headers: authorizedHeaders() }),
      env,
    );
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
    expect(response.headers.get("x-artifact-duration")).toBeNull();
    expect(response.headers.get("x-artifact-tag")).toBeNull();
  });

  it("overwrites an existing artifact on re-upload and updates its TTL", async () => {
    const { kv, env } = setup();
    for (const bytes of [[1], [2, 2]]) {
      const put = request(`/v8/artifacts/${HASH}`, {
        method: "PUT",
        headers: authorizedHeaders({ "Content-Type": "application/octet-stream" }),
        body: new Uint8Array(bytes),
      });
      expect((await worker.fetch(put, env)).status).toBe(200);
    }

    expect(kv.entries.size).toBe(1);
    expect(kv.putCalls).toHaveLength(2);
    const get = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { headers: authorizedHeaders() }),
      env,
    );
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(new Uint8Array([2, 2]));
  });

  it("returns 404 for a cache miss", async () => {
    const { env } = setup();
    const response = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { headers: authorizedHeaders() }),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("answers HEAD with metadata and an empty body on hits, 404 on misses", async () => {
    const { env } = setup();
    const miss = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { method: "HEAD", headers: authorizedHeaders() }),
      env,
    );
    expect(miss.status).toBe(404);

    await worker.fetch(
      request(`/v8/artifacts/${HASH}`, {
        method: "PUT",
        headers: authorizedHeaders({
          "Content-Type": "application/octet-stream",
          "x-artifact-duration": "42",
        }),
        body: new Uint8Array([5]),
      }),
      env,
    );

    const hit = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { method: "HEAD", headers: authorizedHeaders() }),
      env,
    );
    expect(hit.status).toBe(200);
    expect((await hit.arrayBuffer()).byteLength).toBe(0);
    expect(hit.headers.get("x-artifact-duration")).toBe("42");
  });

  it("rejects requests without a valid bearer token", async () => {
    const { env } = setup();

    const missing = await worker.fetch(request(`/v8/artifacts/${HASH}`), env);
    expect(missing.status).toBe(401);

    const wrong = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, {
        headers: { Authorization: "Bearer wrong-token" },
      }),
      env,
    );
    expect(wrong.status).toBe(401);

    const put = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOKEN.trim()}` },
        body: new Uint8Array([1]),
      }),
      env,
    );
    expect(put.status).toBe(200);
  });

  it("rejects artifacts over the 25 MiB KV value limit with 413", async () => {
    const { kv, env } = setup();
    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({
        "Content-Type": "application/octet-stream",
        "Content-Length": String(MAX_ARTIFACT_BYTES + 1),
      }),
    });
    const response = await worker.fetch(put, env);
    expect(response.status).toBe(413);
    expect(kv.entries.size).toBe(0);
  });

  it("serves a status endpoint and swallows analytics events", async () => {
    const { env } = setup();

    const status = await worker.fetch(
      request(`/v8/artifacts/status`, { headers: authorizedHeaders() }),
      env,
    );
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ status: "enabled" });

    const events = await worker.fetch(
      request(`/v8/artifacts/events`, {
        method: "POST",
        headers: authorizedHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ events: [] }),
      }),
      env,
    );
    expect(events.status).toBe(200);
  });

  it("returns 404 for unknown routes and malformed hash routes", async () => {
    const { env } = setup();

    const root = await worker.fetch(request(`/`, { headers: authorizedHeaders() }), env);
    expect(root.status).toBe(404);

    const needHash = await worker.fetch(
      request(`/v8/artifacts/`, { headers: authorizedHeaders() }),
      env,
    );
    expect(needHash.status).toBe(404);

    const shortHash = await worker.fetch(
      request(`/v8/artifacts/short`, { headers: authorizedHeaders() }),
      env,
    );
    expect(shortHash.status).toBe(404);
  });

  it("returns 405 for unsupported methods on the artifact route", async () => {
    const { env } = setup();
    const response = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, {
        method: "DELETE",
        headers: authorizedHeaders(),
      }),
      env,
    );
    expect(response.status).toBe(405);
  });

  it("returns 500 when KV fails", async () => {
    class FailingKv extends MemoryKv {
      override async put(
        _key: string,
        _value: ArrayBuffer,
        _options?: { expirationTtl?: number; metadata?: unknown },
      ): Promise<void> {
        throw new Error("kv unavailable");
      }

      override async getWithMetadata(
        _key: string,
        _type: "arrayBuffer",
      ): Promise<{ value: ArrayBuffer | null; metadata: ArtifactMetadata | null }> {
        throw new Error("kv unavailable");
      }
    }

    const env: TurboCacheEnv = {
      TURBO_CACHE_KV: new FailingKv(),
      TURBO_CACHE_TOKEN: TOKEN,
    };

    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({ "Content-Type": "application/octet-stream" }),
      body: new Uint8Array([1]),
    });
    const response = await worker.fetch(put, env);
    expect(response.status).toBe(500);
  });

  it("verifies the artifact tag when a signature key is configured", async () => {
    const { kv, env } = setup(SIGNATURE_KEY);
    const body = new Uint8Array([7, 7, 7]);
    const tag = tagFor(HASH, "", body, SIGNATURE_KEY);

    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({
        "Content-Type": "application/octet-stream",
        "x-artifact-tag": tag,
      }),
      body,
    });
    expect((await worker.fetch(put, env)).status).toBe(200);

    const stored = kv.entries.get(HASH);
    expect(stored?.metadata?.tag).toBe(tag);

    const get = await worker.fetch(
      request(`/v8/artifacts/${HASH}`, { headers: authorizedHeaders() }),
      env,
    );
    expect(get.status).toBe(200);
    // Signed clients recompute the tag from the body and reject a mismatch.
    expect(get.headers.get("x-artifact-tag")).toBe(tag);
  });

  it("verifies tags signed over a teamId query parameter", async () => {
    const { env } = setup(SIGNATURE_KEY);
    const body = new Uint8Array([8]);
    const tag = tagFor(HASH, "team_xyz", body, SIGNATURE_KEY);

    const put = request(`/v8/artifacts/${HASH}?teamId=team_xyz`, {
      method: "PUT",
      headers: authorizedHeaders({
        "Content-Type": "application/octet-stream",
        "x-artifact-tag": tag,
      }),
      body,
    });
    expect((await worker.fetch(put, env)).status).toBe(200);
  });

  it("rejects a tampered artifact tag with 401 and stores nothing", async () => {
    const { kv, env } = setup(SIGNATURE_KEY);
    const body = new Uint8Array([9]);
    const tag = tagFor(HASH, "", body, SIGNATURE_KEY);

    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({
        "Content-Type": "application/octet-stream",
        "x-artifact-tag": `${tag.slice(0, -2)}AA`,
      }),
      body,
    });
    expect((await worker.fetch(put, env)).status).toBe(401);
    expect(kv.entries.size).toBe(0);
  });

  it("rejects an unsigned upload when a signature key is configured", async () => {
    const { kv, env } = setup(SIGNATURE_KEY);
    const put = request(`/v8/artifacts/${HASH}`, {
      method: "PUT",
      headers: authorizedHeaders({ "Content-Type": "application/octet-stream" }),
      body: new Uint8Array([1]),
    });
    expect((await worker.fetch(put, env)).status).toBe(401);
    expect(kv.entries.size).toBe(0);
  });
});
