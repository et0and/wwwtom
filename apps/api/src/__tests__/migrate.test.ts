import { describe, expect, it } from "vitest";
import type { CmsR2Binding } from "@tom/utils/services/config";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { HttpStatus } from "@tom/constants/http";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const fakeR2 = (files: Map<string, { bytes: ArrayBuffer; mime: string }>): CmsR2Binding => ({
  put: async (key, value, options) => {
    const bytes =
      value instanceof ArrayBuffer
        ? value
        : value instanceof Uint8Array
          ? (value.buffer as ArrayBuffer)
          : (new TextEncoder().encode(value).buffer as ArrayBuffer);
    files.set(key, {
      bytes,
      mime: options?.httpMetadata?.contentType ?? "application/octet-stream",
    });
    return { key };
  },
  get: async (key) => {
    const file = files.get(key);
    if (!file) return null;
    return { key, size: file.bytes.byteLength, arrayBuffer: async () => file.bytes };
  },
  delete: async (key) => {
    files.delete(key);
  },
});

const setup = () => {
  const target = new Map<string, { bytes: ArrayBuffer; mime: string }>();
  const env = testEnv({ CMS_MEDIA: fakeR2(target) });
  return { target, env };
};

type PutBody = {
  readonly key: string;
  readonly contentType?: string;
  readonly contentBase64?: string;
};

const putRequest = (env: ReturnType<typeof testEnv>, body: PutBody, withToken = true): Request => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (withToken) headers.set(INTERNAL_TOKEN_HEADER, "test-internal-token");
  return requestWithEnv("http://localhost/migrate/r2-put", env, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

describe("migrate r2-put (one-off content cutover)", () => {
  it("stores bytes under the key with content type", async () => {
    const { target, env } = setup();
    const response = await app.fetch(
      putRequest(env, {
        key: "media/id/photo.png",
        contentType: "image/png",
        contentBase64: toBase64("image-bytes"),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: "media/id/photo.png", size: 11 });
    const stored = target.get("media/id/photo.png");
    expect(stored?.mime).toBe("image/png");
    expect(new TextDecoder().decode(stored?.bytes)).toBe("image-bytes");
  });

  it("rejects requests without the internal token", async () => {
    const { env } = setup();
    const response = await app.fetch(
      putRequest(
        env,
        { key: "media/id/photo.png", contentType: "image/png", contentBase64: toBase64("x") },
        false,
      ),
    );
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  it("rejects invalid bodies with 400", async () => {
    const { env } = setup();
    const response = await app.fetch(putRequest(env, { key: "media/id/photo.png" }));
    expect(response.status).toBe(HttpStatus.BadRequest);
  });
});
