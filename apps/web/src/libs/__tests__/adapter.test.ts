import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapterBaseUrl, unwrapAdapter } from "~/libs/adapter";
import { HttpError } from "@tom/types";

describe("getAdapterBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the local adapter in dev when no build URL is set", () => {
    expect(getAdapterBaseUrl()).toBe("http://localhost:8788");
  });

  it("uses the build-time VITE_ADAPTER_URL when set", () => {
    vi.stubEnv("VITE_ADAPTER_URL", "https://dev-adapter.tom.so");
    expect(getAdapterBaseUrl()).toBe("https://dev-adapter.tom.so");
  });
});

describe("unwrapAdapter", () => {
  it("returns the data on success", () => {
    const result = { data: { docs: [] }, error: null };
    expect(unwrapAdapter(result)).toEqual({ docs: [] });
  });

  it("returns data even when it is falsy", () => {
    const result = { data: "", error: null };
    expect(unwrapAdapter(result)).toBe("");
  });

  it("throws an HttpError with the adapter message and status", () => {
    expect(() =>
      unwrapAdapter({ data: null, error: { status: 404, value: { error: "Not found" } } }),
    ).toThrow(expect.objectContaining({ message: "Not found", status: 404 }) as unknown as Error);
  });

  it("falls back to a generic message when the error body has no message", () => {
    expect(() =>
      unwrapAdapter({ data: null, error: { status: 400, value: { detail: "nope" } } }),
    ).toThrow("Adapter request failed");
  });

  it("falls back to status 500 when the error status is missing", () => {
    expect(() =>
      unwrapAdapter({ data: null, error: { status: null, value: { error: "boom" } } }),
    ).toThrow(expect.objectContaining({ status: 500 }) as unknown as Error);
  });

  it("throws an HttpError instance", () => {
    try {
      unwrapAdapter({ data: null, error: { status: 500, value: { error: "boom" } } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
    }
  });
});
