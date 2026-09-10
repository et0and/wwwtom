import { describe, expect, it } from "vitest";
import { Schema, SchemaAST } from "effect";
import {
  CmsPostSchema,
  CmsPostSummarySchema,
  CmsWorkSchema,
  CmsWorkSummarySchema,
} from "@tom/schemas/cms";

/**
 * Summary schemas are hand-kept subsets (Effect 4 has no Schema.omit), so
 * pin the key parity: summary keys must equal full keys minus the body.
 * Add a field to CmsPostSchema and this tells you to mirror it in
 * CmsPostSummarySchema (and POST_SUMMARY_COLUMNS, derived from the same
 * list, picks it up structurally).
 */
const structKeys = (schema: Schema.Schema<unknown>): Array<string> => {
  const ast = schema.ast;
  if (!SchemaAST.isObjects(ast)) throw new Error("expected a struct schema");
  return ast.propertySignatures.map((signature) => String(signature.name)).sort();
};

const BODY_KEYS = ["content", "html"];

describe("cms summary shapes", () => {
  it("matches CmsPostSchema minus the body", () => {
    const full = structKeys(CmsPostSchema).filter((key) => !BODY_KEYS.includes(key));
    expect(structKeys(CmsPostSummarySchema)).toEqual(full);
  });

  it("matches CmsWorkSchema minus the body", () => {
    const full = structKeys(CmsWorkSchema).filter((key) => !BODY_KEYS.includes(key));
    expect(structKeys(CmsWorkSummarySchema)).toEqual(full);
  });
});
