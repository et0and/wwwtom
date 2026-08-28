import { Array as Arr, Effect, pipe, String } from "effect";
import { HttpError } from "@tom/types/errors";
import type { AddressDbService } from "./db";
import { SQL } from "./queries";
import { mapAddressRow, type AddressRow } from "./schema";

const MAX_ALIAS_EXPANSIONS = 3;
const MAX_CORRECTION_CANDIDATES = 50;

export interface SearchPlan {
  readonly mode: "exact" | "expanded" | "fuzzy";
  readonly match: string;
}

export interface SearchService {
  readonly search: (
    query: string,
    limit: number,
  ) => Effect.Effect<readonly ReturnType<typeof mapAddressRow>[], HttpError>;
}

// Postgres `to_tsvector('simple', ...)` handles lowercasing and lexing server-side.
// For alias / typo lookups we still need a client-side normalized token form; use Effect's
// String pipe so the transform stays declarative and testable instead of a bespoke regex chain.
const normalizeText = (value: string): string =>
  pipe(
    value,
    String.normalize("NFKD"),
    String.replace(/[\u0300-\u036f]/g, ""),
    String.toLowerCase,
    String.replace(/[^a-z0-9]+/g, " "),
    String.trim,
  );

export const tokenize = (value: string): string[] =>
  pipe(normalizeText(value), String.split(/\s+/), Arr.filter(Boolean));

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const isNumericToken = (token: string): boolean => /^\d+[a-z]?$/.test(token);

export const buildMatch = (groups: string[][]): string | null => {
  const clauses = groups
    .map((group) => unique(group).filter((token) => /^[a-z0-9]+$/.test(token)))
    .filter((group) => group.length > 0)
    .map((group) => {
      const terms = group.map((token) => `${token}*`);
      return terms.length === 1 ? terms[0]! : `(${terms.join(" OR ")})`;
    });

  return clauses.length ? clauses.join(" AND ") : null;
};

const groupsEqual = (left: string[][], right: string[][]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((group, index) => {
    const a = unique(group).sort();
    const b = unique(right[index] ?? []).sort();
    return a.length === b.length && a.every((token, tokenIndex) => token === b[tokenIndex]);
  });
};

export const levenshtein = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, () => 0);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + substitutionCost,
      );
    }
    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column] ?? 0;
    }
  }
  return previous[right.length] ?? 0;
};

const correctionThreshold = (token: string): number => {
  if (token.length <= 4) return 1;
  if (token.length <= 7) return 2;
  return 3;
};

const toTsQuery = (match: string): string =>
  match
    .replace(/\b([a-z0-9]+)\*/g, "$1:*")
    .replace(/\bAND\b/g, "&")
    .replace(/\bOR\b/g, "|");

const dbError = (operation: string, cause: unknown): HttpError =>
  new HttpError({ message: `Search error during ${operation}`, status: 500, cause });

type AliasRow = { expansion: string };
type TermRow = { normalized_term: string; frequency: number | string | bigint };
type CountRow = {
  search_term_count: number | string | bigint;
  address_count: number | string | bigint;
};

export const makeSearchService = (db: AddressDbService): SearchService => {
  const getAliasExpansions = (
    token: string,
    previousToken?: string,
    nextToken?: string,
  ): Effect.Effect<readonly string[], HttpError> =>
    Effect.gen(function* () {
      if (token === "st") {
        if (previousToken && isNumericToken(previousToken)) return ["street"];
        if (nextToken && !isNumericToken(nextToken)) return ["street", "saint"];
      }
      const sql = yield* db.replica;
      const rows = yield* Effect.tryPromise({
        try: () => sql.unsafe<AliasRow>(SQL.selectAliasExpansions, [token, MAX_ALIAS_EXPANSIONS]),
        catch: (cause) => dbError("getAliasExpansions", cause),
      });
      return unique(rows.map((row) => row.expansion));
    });

  const getCorrection = (token: string): Effect.Effect<string | null, HttpError> =>
    Effect.gen(function* () {
      if (token.length < 4 || isNumericToken(token)) return null;

      const minLength = Math.max(2, token.length - 2);
      const maxLength = token.length + 2;
      const sql = yield* db.replica;
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<TermRow>(SQL.selectCorrectionCandidates, [
            token.charAt(0),
            minLength,
            maxLength,
            MAX_CORRECTION_CANDIDATES,
          ]),
        catch: (cause) => dbError("getCorrection", cause),
      });

      let bestToken: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestFrequency = -1;

      for (const candidate of rows) {
        const frequency = Number(candidate.frequency);
        const distance = levenshtein(token, candidate.normalized_term);
        if (distance === 0 || distance > correctionThreshold(token)) continue;

        if (
          distance < bestDistance ||
          (distance === bestDistance && frequency > bestFrequency) ||
          (distance === bestDistance &&
            frequency === bestFrequency &&
            candidate.normalized_term < (bestToken ?? "~"))
        ) {
          bestToken = candidate.normalized_term;
          bestDistance = distance;
          bestFrequency = frequency;
        }
      }
      return bestToken;
    });

  const ensureSearchTermsReady: Effect.Effect<void, HttpError> = Effect.gen(function* () {
    const sql = yield* db.replica;
    const rows = yield* Effect.tryPromise({
      try: () => sql.unsafe<CountRow>(SQL.selectSearchCounts),
      catch: (cause) => dbError("ensureSearchTermsReady", cause),
    });
    const searchTermCount = Number(rows[0]?.search_term_count ?? 0);
    const addressCount = Number(rows[0]?.address_count ?? 0);
    if (searchTermCount === 0 && addressCount > 0) {
      yield* db.rebuildSearchTerms;
    }
  });

  const buildPlans = (query: string): Effect.Effect<readonly SearchPlan[], HttpError> =>
    Effect.gen(function* () {
      yield* ensureSearchTermsReady;
      const tokens = tokenize(query);
      if (!tokens.length) return [];

      const exactGroups = tokens.map((token) => [token]);

      const expandedGroups = yield* Effect.all(
        tokens.map((token, index) =>
          getAliasExpansions(token, tokens[index - 1], tokens[index + 1]).pipe(
            Effect.map((expansions) => unique([token, ...expansions])),
          ),
        ),
      );

      const fuzzyGroups = yield* Effect.all(
        expandedGroups.map((group, index) =>
          getCorrection(tokens[index] ?? "").pipe(
            Effect.map((correction) => (correction ? unique([...group, correction]) : group)),
          ),
        ),
      );

      const plans: SearchPlan[] = [];
      const exactMatch = buildMatch(exactGroups);
      const expandedMatch = buildMatch(expandedGroups);
      const fuzzyMatch = buildMatch(fuzzyGroups);

      if (exactMatch) plans.push({ mode: "exact", match: exactMatch });
      if (
        expandedMatch &&
        expandedMatch !== exactMatch &&
        !groupsEqual(expandedGroups, exactGroups)
      ) {
        plans.push({ mode: "expanded", match: expandedMatch });
      }
      if (
        fuzzyMatch &&
        fuzzyMatch !== exactMatch &&
        fuzzyMatch !== expandedMatch &&
        !groupsEqual(fuzzyGroups, expandedGroups)
      ) {
        plans.push({ mode: "fuzzy", match: fuzzyMatch });
      }

      return plans;
    });

  const search: SearchService["search"] = (query, limit) =>
    Effect.gen(function* () {
      const plans = yield* buildPlans(query);
      if (!plans.length) return [];

      const sql = yield* db.replica;

      for (const plan of plans) {
        const tsQuery = toTsQuery(plan.match);
        const rows = yield* Effect.tryPromise({
          try: () => sql.unsafe<AddressRow>(SQL.searchAddresses, [tsQuery, limit]),
          catch: (cause) => dbError("search", cause),
        });
        if (rows.length) return rows.map(mapAddressRow);
      }

      return [];
    });

  return { search };
};
