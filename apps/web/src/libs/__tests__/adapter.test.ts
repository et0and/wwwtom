import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapterBaseUrl, unwrapAdapter } from "~/libs/adapter";
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
    let error: unknown;
    try {
      unwrapAdapter({
        data: null,
        error: {
          status: 404,
          value: {
            type: "https://errors.tom.so/not-found",
            status: 404,
            title: "Not found",
          },
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ message: "Not found", status: 404 });
  });

  it("prefers detail over title for the user-facing message", () => {
    let error: unknown;
    try {
      unwrapAdapter({
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
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ message: "title - too long", status: 400 });
  });

  it("falls back to a generic message when the error body is not problem details", () => {
    expect(() =>
      unwrapAdapter({ data: null, error: { status: 400, value: { error: "legacy" } } }),
    ).toThrow("Adapter request failed");
  });

  it("falls back to status 500 when the error status is missing", () => {
    let error: unknown;
    try {
      unwrapAdapter({
        data: null,
        error: {
          status: null,
          value: { type: "about:blank", status: 500, title: "boom" },
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 500 });
  });

  it("throws an HttpError instance", () => {
    try {
      unwrapAdapter({
        data: null,
        error: { status: 500, value: { type: "about:blank", status: 500, title: "boom" } },
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
    }
  });
});
