import { describe, expect, it } from "vitest";
import {
  dashboardLinks,
  toErrorMessage,
  toProblemResponse,
  toValidationProblems,
} from "../src/worker";

describe("toProblemResponse", () => {
  it("keeps a valid error status and defaults the type to about:blank", async () => {
    const response = toProblemResponse(502, "upstream down");
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({
      type: "about:blank",
      status: 502,
      title: "upstream down",
    });
  });

  it("carries problem details, instance, and validation errors", async () => {
    const response = toProblemResponse(400, "Validation error", {
      type: "https://errors.tom.so/validation",
      detail: "title - too long",
      instance: "http://localhost/og",
      errors: [{ pointer: "#/title", detail: "too long" }],
    });
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Validation error",
      detail: "title - too long",
      instance: "http://localhost/og",
      errors: [{ pointer: "#/title", detail: "too long" }],
    });
  });

  it("falls back to 500 for a 0 sentinel", () => {
    expect(toProblemResponse(0, "boom").status).toBe(500);
  });

  it("falls back to 500 for a redirect-class status", () => {
    expect(toProblemResponse(302, "boom").status).toBe(500);
  });

  it("falls back to 500 for a non-error status", () => {
    expect(toProblemResponse(200, "boom").status).toBe(500);
  });

  it("keeps 400 and 599 as valid error statuses", async () => {
    expect(toProblemResponse(400, "bad").status).toBe(400);
    expect(toProblemResponse(599, "edge").status).toBe(599);
    expect(((await toProblemResponse(599, "edge").json()) as { status: number }).status).toBe(599);
  });

  it("falls back to 500 if status exceeds 599", async () => {
    const response = toProblemResponse(600, "boom");
    expect(response.status).toBe(500);
    expect(((await response.json()) as { status: number }).status).toBe(500);
  });

  it("falls back to 500 for negative and non-integer statuses", () => {
    expect(toProblemResponse(-1, "boom").status).toBe(500);
    expect(toProblemResponse(404.5, "boom").status).toBe(500);
    expect(toProblemResponse(Number.NaN, "boom").status).toBe(500);
  });

  it("preserves content-type application/problem+json", async () => {
    const response = toProblemResponse(600, "boom");
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(((await response.json()) as { title: string }).title).toBe("boom");
  });
});

describe("toValidationProblems", () => {
  it("maps dot-joined Elysia paths to JSON pointers", () => {
    expect(
      toValidationProblems({
        all: [{ path: "attrs.language", message: "Required" }],
      }),
    ).toEqual([{ detail: "Required", pointer: "#/attrs/language" }]);
  });

  it("escapes ~ and / inside a path segment", () => {
    expect(
      toValidationProblems({
        all: [{ path: "a~b.c/d", message: "Bad" }],
      }),
    ).toEqual([{ detail: "Bad", pointer: "#/a~0b/c~1d" }]);
  });

  it("maps the root path to the whole-document fragment", () => {
    expect(toValidationProblems({ all: [{ path: "root", message: "Bad" }] })).toEqual([
      { detail: "Bad", pointer: "#" },
    ]);
  });

  it("returns undefined for an empty or unparseable failure", () => {
    expect(toValidationProblems({ all: [] })).toBeUndefined();
    expect(toValidationProblems({})).toBeUndefined();
    expect(toValidationProblems("boom")).toBeUndefined();
  });
});

describe("toErrorMessage", () => {
  it("reads an Error message", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("passes a string through unchanged", () => {
    expect(toErrorMessage("boom")).toBe("boom");
  });

  it("returns a placeholder for null and undefined", () => {
    expect(toErrorMessage(null)).toBe("unknown error");
    expect(toErrorMessage(undefined)).toBe("unknown error");
  });

  it("stringifies a value that String() cannot coerce", () => {
    const record = Object.assign(Object.create(null), { code: "E_BOOM" });
    expect(toErrorMessage(record)).toContain("E_BOOM");
  });
});

describe("dashboardLinks", () => {
  it("links Axiom logs and the Cloudflare workers dashboard", () => {
    expect(dashboardLinks()).toEqual([
      { text: "Axiom logs", url: "https://app.axiom.co/yufugumi-tchp/query" },
      {
        text: "Cloudflare Workers",
        url: "https://dash.cloudflare.com/?to=/:account/workers-and-pages",
      },
    ]);
  });
});
