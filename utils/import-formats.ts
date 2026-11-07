// Statement files other than CSV, and duplicate detection for every import.
//
// OFX/QFX (most banks' "Money" export) and QIF (Quicken) are turned into the same rows a CSV gives,
// so categories, rules and skipping work the same. Firefly III and Actual Budget exports are CSVs
// and go through parseImportCsv, which reads their type column and signed amounts.
// Tested in scripts/test-import-csv.mts.

import { format } from 'date-fns'
import { parseImportCsv, parseImportRows, type ColumnMapping, type ImportRow, type ParsedImport } from './import-csv'
import type { Rule } from './rules'

export type ImportFormat = 'csv' | 'ofx' | 'qif'

type Row = Record<string, string>

export function detectFormat(content: string, fileName = ''): ImportFormat {
  const name = fileName.toLowerCase()
  if (name.endsWith('.ofx') || name.endsWith('.qfx') || /<OFX>|OFXHEADER/i.test(content.slice(0, 2000))) return 'ofx'
  if (name.endsWith('.qif') || /^!Type:/im.test(content.slice(0, 500))) return 'qif'
  return 'csv'
}

const signedRow = (date: string, amount: number, description: string, extra: Row = {}): Row => ({
  date,
  amount: String(Math.abs(amount)),
  indicator: amount < 0 ? 'DEBIT' : 'CREDIT',
  description,
  ...extra,
})

/** OFX 1.x (SGML, tags often left open) and OFX 2.x (XML). */
export function ofxRows(content: string): Row[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0])
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
    return m ? m[1].trim() : ''
  }
  return blocks.flatMap((b) => {
    const posted = tag(b, 'DTPOSTED')
    const amount = Number(tag(b, 'TRNAMT').replace(/,/g, ''))
    if (!/^\d{8}/.test(posted) || !Number.isFinite(amount)) return []
    const date = `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`
    const name = tag(b, 'NAME')
    const memo = tag(b, 'MEMO')
    return [signedRow(date, amount, memo && memo !== name ? memo : name, { payee: memo && memo !== name ? name : '', reference: tag(b, 'FITID') })]
  })
}

/** QIF dates: 01/05/2024, 1/5/24, 1/ 5'24 (month first, as Quicken writes them). */
function qifDate(raw: string): string | null {
  const m = raw.replace(/\s/g, '').replace("'", '/').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function qifRows(content: string): Row[] {
  const rows: Row[] = []
  let cur: Record<string, string> = {}
  const flush = () => {
    const date = qifDate(cur.D ?? '')
    const amount = Number((cur.T ?? cur.U ?? '').replace(/,/g, ''))
    if (date && Number.isFinite(amount) && amount !== 0) {
      const payee = cur.P ?? ''
      const memo = cur.M ?? ''
      // "[Savings]" in the category line is a transfer to another account, not a category.
      const category = cur.L && !cur.L.startsWith('[') ? cur.L.split(':')[0] : ''
      rows.push(signedRow(date, amount, payee || memo, { payee: payee && memo ? memo : '', reference: cur.N ?? '', category }))
    }
    cur = {}
  }
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('!')) continue
    if (line.startsWith('^')) flush()
    else cur[line[0]] = line.slice(1).trim()
  }
  if (Object.keys(cur).length) flush()
  return rows
}

/** Any supported statement file to import rows. */
export function parseImportFile(
  content: string,
  fileName: string,
  categories: { id: string; name: string }[],
  defaultCategoryId?: string | null,
  rules: Rule[] = [],
  mapping?: ColumnMapping
): ParsedImport & { format: ImportFormat } {
  const fmt = detectFormat(content, fileName)
  if (fmt === 'ofx') return { ...parseImportRows(ofxRows(content), categories, defaultCategoryId, rules), format: fmt }
  if (fmt === 'qif') return { ...parseImportRows(qifRows(content), categories, defaultCategoryId, rules), format: fmt }
  return { ...parseImportCsv(content, categories, defaultCategoryId, rules, mapping), format: fmt }
}

// ---------- Duplicates ----------

export interface ExistingTx {
  date: string
  amount: number | string
  type: string
  description?: string | null
}

const normDesc = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)
const dupKey = (t: { date: string; amount: number | string; type: string; description?: string | null }) =>
  `${format(new Date(t.date), 'yyyy-MM-dd')}|${Number(t.amount).toFixed(2)}|${t.type}|${normDesc(t.description)}`

/**
 * Drops rows already in the wallet: same day, amount, direction and description. Matching is one to
 * one, so two identical ₱150 coffees on one day import twice only if the wallet has fewer than two.
 */
export function dropDuplicates(rows: ImportRow[], existing: ExistingTx[]): { fresh: ImportRow[]; duplicates: number } {
  const counts = new Map<string, number>()
  for (const t of existing) counts.set(dupKey(t), (counts.get(dupKey(t)) ?? 0) + 1)
  const fresh: ImportRow[] = []
  let duplicates = 0
  for (const r of rows) {
    const key = dupKey(r)
    const left = counts.get(key) ?? 0
    if (left > 0) {
      counts.set(key, left - 1)
      duplicates++
    } else fresh.push(r)
  }
  return { fresh, duplicates }
}
