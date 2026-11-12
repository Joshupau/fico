// A stable key for an imported row so importing the same file twice does not create the row twice.
//
// The key is a hash of the row's content plus its occurrence number within the file: two genuinely
// identical purchases on one statement get keys ending in #1 and #2, while the same file imported
// again produces the same keys and the database skips them (migration 0072_import_idempotent).
import type { ImportRow } from './import-csv'

const encoder = new TextEncoder()

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const digest = await subtle.digest('SHA-256', encoder.encode(text))
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback for runtimes without Web Crypto (should not happen in the app): two 32-bit FNV-1a hashes.
  let a = 0x811c9dc5
  let b = 0x01000193
  for (const byte of encoder.encode(text)) {
    a = Math.imul(a ^ byte, 0x01000193) >>> 0
    b = Math.imul(b ^ byte, 0x5bd1e995) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

export type KeyedImportRow = ImportRow & { import_key: string }

/** Adds an import_key to every row. Pure function of the rows' content and order of repeats. */
export async function withImportKeys(rows: ImportRow[]): Promise<KeyedImportRow[]> {
  const seen = new Map<string, number>()
  const out: KeyedImportRow[] = []
  for (const row of rows) {
    const content = [row.date.slice(0, 10), row.amount.toFixed(2), row.type, row.description.trim().toLowerCase()].join('|')
    const n = (seen.get(content) ?? 0) + 1
    seen.set(content, n)
    out.push({ ...row, import_key: await sha256Hex(`${content}#${n}`) })
  }
  return out
}
