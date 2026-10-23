import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapterBaseUrl, runAdapterCall } from "~/data/adapter";
import type { EdenResult } from "@tom/utils/http";
import { HttpError } from "@tom/types/errors";

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

const call = <T>(result: EdenResult<T>) => runAdapterCall(() => Promise.resolve(result));

const rejection = async (result: EdenResult<unknown>): Promise<unknown> => {
  let caught: unknown;
  try {
    await call(result);
  } catch (error) {
    caught = error;
  }
  return caught;
};

describe("runAdapterCall", () => {
  it("returns the data on success", async () => {
    await expect(call({ data: { docs: [] }, error: null })).resolves.toEqual({ docs: [] });
  });

  it("returns data even when it is falsy", async () => {
    await expect(call({ data: "", error: null })).resolves.toBe("");
  });

  it("fails with an HttpError carrying the adapter message and status", async () => {
    const error = await rejection({
      data: null,
      error: {
        status: 404,
        value: { type: "https://errors.tom.so/not-found", status: 404, title: "Not found" },
      },
    });
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ message: "Not found", status: 404 });
  });

  it("prefers detail over title for the user-facing message", async () => {
    const error = await rejection({
      data: null,
      error: {
        status: 400,
        value: {
          type: "https://errors.tom.so/validation",
          status: 400,
          title: "Validation error",
          detail: "title - too long",
        },
      },
    });
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ message: "title - too long", status: 400 });
  });

  it("falls back to a generic message when the error body is not problem details", async () => {
    const error = await rejection({
      data: null,
      error: { status: 400, value: { error: "legacy" } },
    });
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ message: "Adapter request failed" });
  });

  it("falls back to status 500 when the error status is missing", async () => {
    const error = await rejection({
      data: null,
      error: { status: null, value: { type: "about:blank", status: 500, title: "boom" } },
    });
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 500 });
  });

  it("falls back to status 500 for a status that is not an error code", async () => {
    // `Number(x) || 500` used to pass a truthy non-error status straight through
    // as the response status.
    const error = await rejection({
      data: null,
      error: { status: 302, value: { type: "about:blank", status: 302, title: "moved" } },
    });
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 500 });
  });

  it("fails with an HttpError instance", async () => {
    const error = await rejection({
      data: null,
      error: { status: 500, value: { type: "about:blank", status: 500, title: "boom" } },
    });
    expect(error).toBeInstanceOf(HttpError);
  });
});
