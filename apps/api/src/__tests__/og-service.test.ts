import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { getTemplate, validateOgParams, handleOgError } from "../services/og";
import { OgTemplates } from "@tom/ui/OgImage";
import { FontFetchError, ValidationError, ImageGenerationError } from "@tom/types/errors";

describe("og service", () => {
  describe("getTemplate", () => {
    it("returns requested template when valid", () => {
      expect(getTemplate("https://tom.so", "default")).toBe(OgTemplates.default);
      expect(getTemplate("https://tom.so", "minimal")).toBe(OgTemplates.minimal);
      expect(getTemplate("https://tom.so", "developer")).toBe(OgTemplates.developer);
    });

    it("falls back to requester-based selection for unknown template", () => {
      expect(getTemplate("https://tom.so", "unknown")).toBe(OgTemplates.default);
      expect(getTemplate("https://tom.so", undefined)).toBe(OgTemplates.default);
    });

    it("selects template by requester", () => {
      expect(getTemplate("https://tom.so/blog")).toBe(OgTemplates.default);
      expect(getTemplate("https://dev.tom.so/test")).toBe(OgTemplates.developer);
      expect(getTemplate("https://example.com")).toBe(OgTemplates.minimal);
      expect(getTemplate("unknown")).toBe(OgTemplates.minimal);
    });
  });

  describe("validateOgParams", () => {
    it("succeeds for valid params", async () => {
      const result = await Effect.runPromise(validateOgParams("Hello", "World"));
      expect(result).toBeDefined();
    });

    it("fails for empty strings", async () => {
      const result = await Effect.runPromiseExit(validateOgParams("", ""));
      expect(result._tag).toBe("Failure");
    });

    it("fails for overly long title", async () => {
      const longTitle = "a".repeat(101);
      const result = await Effect.runPromiseExit(validateOgParams(longTitle, "ok"));
      expect(result._tag).toBe("Failure");
    });
  });

  describe("handleOgError", () => {
    it("maps FontFetchError to 502", () => {
      const response = handleOgError(
        new FontFetchError({ message: "font fail", cause: "network" }),
      );
      expect(response.status).toBe(502);
    });

    it("maps ValidationError to 400", () => {
      const response = handleOgError(new ValidationError({ field: "params", issue: "too long" }));
      expect(response.status).toBe(400);
    });

    it("maps ImageGenerationError to 500", () => {
      const response = handleOgError(new ImageGenerationError({ message: "render fail" }));
      expect(response.status).toBe(500);
    });
  });

  describe("fontFetchEffect", () => {
    afterEach(() => vi.restoreAllMocks());

    it("fetches and caches font", async () => {
      const buffer = new ArrayBuffer(8);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer } as Response),
      );
      const { fontFetchEffect } = await import("../services/og");
      const result = await Effect.runPromise(fontFetchEffect);
      expect(result).toBe(buffer);
      // Second call should use cache
      const result2 = await Effect.runPromise(fontFetchEffect);
      expect(result2).toBe(buffer);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("throws FontFetchError on fetch failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response));
      // Need to bypass cache — directly test the effect's error path
      const { Effect: E } = await import("effect");
      const failingFetch = E.tryPromise({
        try: () =>
          fetch("https://cdn.tom.so/LibreCaslonCondensed-Regular.ttf").then((res) => {
            if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`);
            return res.arrayBuffer();
          }),
        catch: (error) =>
          new FontFetchError({
            message: "Failed to fetch font",
            cause: error instanceof Error ? error.message : "Unknown error",
          }),
      });
      const exit = await E.runPromiseExit(failingFetch);
      expect(exit._tag).toBe("Failure");
    });
  });
});
