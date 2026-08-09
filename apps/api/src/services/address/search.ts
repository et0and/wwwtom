import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { HttpError } from "@tom/types/errors";
import { runQuery, type AddressDbService, type AddressDatabase } from "./db";
import { mapAddressRow, type Address, type AddressRow } from "./addresses";

const MAX_ALIAS_EXPANSIONS = 3;
const MAX_CORRECTION_CANDIDATES = 50;

export interface SearchPlan {
  readonly mode: "exact" | "expanded" | "fuzzy";
  readonly match: string;
}

export interface SearchService {
  readonly search: (query: string, limit: number) => Effect.Effect<readonly Address[], HttpError>;
}

export const normalizeText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const tokenize = (value: string): string[] =>
  normalizeText(value).split(/\s+/).filter(Boolean);

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const isNumericToken = (token: string): boolean => /^\d+[a-z]?$/.test(token);

export const buildMatch = (groups: string[][]): string | null => {
  const clauses = groups
    .map((group) => unique(group).filter((token) => /^[a-z0-9]+$/.test(token)))
    .filter((group) => group.length > 0)
    .map((group) => {
      const terms = group.map((token) => `${token}*`);
      return terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`;
    });

  return clauses.length ? clauses.join(" AND ") : null;
};

const groupsEqual = (left: string[][], right: string[][]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((group, index) => {
    const a = unique(group).sort();
    const b = unique(right[index] ?? []).sort();
    return a.length === b.length && a.every((token, tokenIndex) => token === b[tokenIndex]);
  });
};

export const levenshtein = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

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
  if (token.length <= 4) {
    return 1;
  }

  if (token.length <= 7) {
    return 2;
  }

  return 3;
};

const toTsQuery = (match: string): string =>
  match
    .replace(/\b([a-z0-9]+)\*/g, "$1:*")
    .replace(/\bAND\b/g, "&")
    .replace(/\bOR\b/g, "|");

export const makeSearchService = (db: AddressDbService): SearchService => {
  const getAliasExpansions = (
    database: AddressDatabase,
    token: string,
    previousToken?: string | undefined,
    nextToken?: string | undefined,
  ): Effect.Effect<readonly string[], HttpError> =>
    Effect.gen(function* () {
      if (token === "st") {
        if (previousToken && isNumericToken(previousToken)) {
          return ["street"];
        }

        if (nextToken && !isNumericToken(nextToken)) {
          return ["street", "saint"];
        }
      }

      const rows = yield* runQuery<{ expansion: string }>(
        database,
        sql`SELECT expansion
             FROM search_aliases
             WHERE alias = ${token}
             ORDER BY priority DESC, expansion ASC
             LIMIT ${MAX_ALIAS_EXPANSIONS}`,
        "getAliasExpansions",
      );

      return unique(rows.map((row) => row.expansion));
    });

  const getCorrection = (
    database: AddressDatabase,
    token: string,
  ): Effect.Effect<string | null, HttpError> =>
    Effect.gen(function* () {
      if (token.length < 4 || isNumericToken(token)) {
        return null;
      }

      const minLength = Math.max(2, token.length - 2);
      const maxLength = token.length + 2;
      const rows = yield* runQuery<{ normalized_term: string; frequency: number }>(
        database,
        sql`SELECT normalized_term, frequency
             FROM search_terms
             WHERE substr(normalized_term, 1, 1) = ${token.charAt(0)}
               AND length(normalized_term) BETWEEN ${minLength} AND ${maxLength}
             ORDER BY frequency DESC, normalized_term ASC
             LIMIT ${MAX_CORRECTION_CANDIDATES}`,
        "getCorrection",
      );

      let bestToken: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestFrequency = -1;

      for (const candidate of rows) {
        const distance = levenshtein(token, candidate.normalized_term);
        if (distance === 0 || distance > correctionThreshold(token)) {
          continue;
        }

        if (
          distance < bestDistance ||
          (distance === bestDistance && candidate.frequency > bestFrequency) ||
          (distance === bestDistance &&
            candidate.frequency === bestFrequency &&
            candidate.normalized_term < (bestToken ?? "~"))
        ) {
          bestToken = candidate.normalized_term;
          bestDistance = distance;
          bestFrequency = candidate.frequency;
        }
      }

      return bestToken;
    });

  const ensureSearchTermsReady = (database: AddressDatabase): Effect.Effect<void, HttpError> =>
    Effect.gen(function* () {
      const rows = yield* runQuery<{ search_term_count: number; address_count: number }>(
        database,
        sql`SELECT
          (SELECT COUNT(*) FROM search_terms) AS search_term_count,
          (SELECT COUNT(*) FROM addresses) AS address_count`,
        "ensureSearchTermsReady",
      );

      if (rows[0]?.search_term_count === 0 && (rows[0]?.address_count ?? 0) > 0) {
        yield* db.rebuildSearchTerms;
      }
    });

  const buildPlans = (
    database: AddressDatabase,
    query: string,
  ): Effect.Effect<readonly SearchPlan[], HttpError> =>
    Effect.gen(function* () {
      yield* ensureSearchTermsReady(database);

      const tokens = tokenize(query);
      if (!tokens.length) {
        return [];
      }

      const exactGroups = tokens.map((token) => [token]);

      const expandedGroups = yield* Effect.all(
        tokens.map((token, index) =>
          getAliasExpansions(database, token, tokens[index - 1], tokens[index + 1]).pipe(
            Effect.map((expansions) => unique([token, ...expansions])),
          ),
        ),
      );

      const fuzzyGroups = yield* Effect.all(
        expandedGroups.map((group, index) =>
          getCorrection(database, tokens[index] ?? "").pipe(
            Effect.map((correction) => (correction ? unique([...group, correction]) : group)),
          ),
        ),
      );

      const plans: SearchPlan[] = [];
      const exactMatch = buildMatch(exactGroups);
      const expandedMatch = buildMatch(expandedGroups);
      const fuzzyMatch = buildMatch(fuzzyGroups);

      if (exactMatch) {
        plans.push({ mode: "exact", match: exactMatch });
      }

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
      const database = yield* db.get;
      const plans = yield* buildPlans(database, query);

      for (const plan of plans) {
        const rows = yield* runQuery<AddressRow>(
          database,
          sql`SELECT a.*, p.postcode
               FROM addresses a
               LEFT JOIN address_postcodes p ON p.address_id = a.address_id
               CROSS JOIN to_tsquery('simple', ${toTsQuery(plan.match)}) AS q
               WHERE a.search_vector @@ q.query
               ORDER BY ts_rank(a.search_vector, q.query) DESC
               LIMIT ${limit}`,
          "search",
        );

        if (rows.length) {
          return rows.map(mapAddressRow);
        }
      }

      return [];
    });

  return { search };
};
