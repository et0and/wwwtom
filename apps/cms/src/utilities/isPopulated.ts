/**
 * Type guard for Payload relationship fields, which are `number | Doc`
 * depending on whether the query populated the relation.
 *
 * Uses `instanceof Object` rather than `typeof` so populated documents
 * (plain objects) are distinguished from unpopulated ids and null.
 */
export const isPopulated = <T extends object>(
  value: T | number | string | null | undefined,
): value is T => value instanceof Object;
