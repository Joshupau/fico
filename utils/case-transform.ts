// Postgres/Supabase columns are snake_case; every existing component and
// type in this app expects the camelCase field names the old Mongoose
// `.toObject()` responses used (e.g. `accountNumber`, `dueDate`,
// `isRecurring`). Applying this at the query-hook boundary keeps every
// consuming component unchanged.
export function toCamelCase<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => toCamelCase(v)) as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()),
        toCamelCase(v),
      ])
    ) as T;
  }
  return value as T;
}
