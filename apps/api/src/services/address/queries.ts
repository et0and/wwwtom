export const SQL = {
  deleteSearchTerms: `DELETE FROM search_terms`,

  insertSearchAlias: `INSERT INTO search_aliases (alias, expansion, priority) VALUES ($1, $2, $3) ON CONFLICT (alias, expansion) DO NOTHING`,

  selectDatasetVersion: `SELECT update_sequence FROM dataset_version ORDER BY ingested_at DESC LIMIT 1`,

  selectKeyHash: `SELECT key_hash FROM api_keys WHERE key_hash = $1 AND enabled = 1 LIMIT 1`,

  insertApiKey: `INSERT INTO api_keys (key_hash, created_at) VALUES ($1, $2) ON CONFLICT (key_hash) DO NOTHING`,

  selectAliasExpansions: `SELECT expansion FROM search_aliases WHERE alias = $1 ORDER BY priority DESC, expansion ASC LIMIT $2`,

  selectCorrectionCandidates: `SELECT normalized_term, frequency FROM search_terms WHERE substr(normalized_term, 1, 1) = $1 AND length(normalized_term) BETWEEN $2 AND $3 ORDER BY frequency DESC, normalized_term ASC LIMIT $4`,

  selectSearchCounts: `SELECT (SELECT COUNT(*) FROM search_terms) AS search_term_count, (SELECT COUNT(*) FROM addresses) AS address_count`,

  searchAddresses: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id CROSS JOIN to_tsquery('simple', $1) AS q(query) WHERE a.search_vector @@ q.query ORDER BY ts_rank(a.search_vector, q.query) DESC LIMIT $2`,

  selectAddressById: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id WHERE a.address_id = $1 LIMIT 1`,

  selectAddressesByTown: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id WHERE a.town_city = $1 ORDER BY a.address_id ASC LIMIT $2 OFFSET $3`,

  selectAddressesBySuburb: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id WHERE a.suburb_locality = $1 ORDER BY a.address_id ASC LIMIT $2 OFFSET $3`,

  selectAddressesByRoad: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id WHERE a.road_name = $1 ORDER BY a.address_id ASC LIMIT $2 OFFSET $3`,

  selectAddressesByBbox: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id WHERE a.lng BETWEEN $1 AND $2 AND a.lat BETWEEN $3 AND $4 ORDER BY a.address_id ASC LIMIT $5 OFFSET $6`,

  selectAddressesOrdered: `SELECT a.*, p.postcode FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id ORDER BY a.address_id ASC LIMIT $1 OFFSET $2`,

  selectReverseGeocode: `SELECT a.*, p.postcode, (abs(a.lng - $1) + abs(a.lat - $2)) AS distance FROM addresses a LEFT JOIN address_postcodes p ON p.address_id = a.address_id ORDER BY distance ASC LIMIT $3`,

  countAddresses: `SELECT COUNT(*)::int AS count FROM addresses`,

  selectMeta: `SELECT updated_at, ingested_at FROM dataset_version ORDER BY ingested_at DESC LIMIT 1`,
} as const;

const ALLOWED_REBUILD_COLUMNS = new Set([
  "road_name_ascii",
  "road_type_name_ascii",
  "suburb_locality_ascii",
  "town_city_ascii",
]);

export const buildRebuildTermsQuery = (kind: string, columnName: string): string => {
  if (!ALLOWED_REBUILD_COLUMNS.has(columnName)) {
    throw new Error(`Invalid column for rebuild: ${columnName}`);
  }

  return `
        INSERT INTO search_terms (normalized_term, canonical_term, kind, frequency)
        SELECT token, token, $1, SUM(weight)
        FROM (
          SELECT value, COUNT(*) AS weight
          FROM (
            SELECT regexp_replace(lower(trim(${columnName})), '[^a-z0-9]+', ' ', 'g') AS value
            FROM addresses
            WHERE ${columnName} IS NOT NULL AND trim(${columnName}) != ''
          ) grouped
          GROUP BY value
        ) source
        CROSS JOIN LATERAL regexp_split_to_table(source.value, ' ') AS token
        WHERE token != '' AND length(token) > 1
        GROUP BY token
        ON CONFLICT (normalized_term, kind) DO UPDATE SET
          canonical_term = EXCLUDED.canonical_term,
          frequency = EXCLUDED.frequency
      `;
};
