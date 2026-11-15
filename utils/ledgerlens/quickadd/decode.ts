/**
 * Turns tagged spans into transaction fields. Everything here is deterministic: the model only
 * says which tokens are what; the numbers and names are worked out by code that can be tested.
 */
import type { Tagged, Span } from './tagger'

export interface QuickAddContext {
  wallets: { name: string; type?: string }[]
  categories: { name: string; type?: string }[]
  now: Date
}

export interface QuickAddResult {
  amount?: number
  type?: 'expense' | 'income' | 'transfer'
  fromWalletName?: string
  toWalletName?: string
  inferredCategoryName?: string
  date?: string
  serviceFee?: number
  description?: string
  confidence: { amount: number; type: number; wallet: number; category: number }
  /** Why each field was chosen, for the review UI and the eval misses list. */
  evidence: string[]
}

/** "1,250.50" / "1.2k" / "₱300" / "2.5K" -> number, or null. Integer centavos under the hood. */
export function parseMoneyToken(text: string): number | null {
  let s = text.toLowerCase().replace(/^(?:₱|php|p)/, '').replace(/,/g, '')
  let thousands = false
  if (s.endsWith('k')) {
    thousands = true
    s = s.slice(0, -1)
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  const [whole = '0', frac = ''] = s.split('.')
  let centavos = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (thousands) centavos = Number(whole) * 100_000 + Number((frac + '000').slice(0, 3)) * 100
  if (!Number.isSafeInteger(centavos) || centavos === 0) return null
  return centavos / 100
}

/** Damerau-style edit distance, enough for one or two typos in a short name. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)])
  for (let j = 1; j <= n; j++) (d[0] as number[])[j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min((d[i - 1] as number[])[j]! + 1, (d[i] as number[])[j - 1]! + 1, (d[i - 1] as number[])[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (d[i - 2] as number[])[j - 2]! + 1)
      ;(d[i] as number[])[j] = v
    }
  }
  return (d[m] as number[])[n]!
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Matches a wallet span to a configured wallet, tolerating typos and partial names ("gotym" -> GoTyme). */
export function matchWallet(span: string, wallets: QuickAddContext['wallets']): { name: string; score: number } | null {
  const q = norm(span)
  if (!q) return null
  let best: { name: string; score: number } | null = null
  for (const w of wallets) {
    const full = norm(w.name)
    const words = w.name.toLowerCase().split(/\s+/).map(norm)
    let score = 0
    if (full === q) score = 1
    else if (words.includes(q)) score = 0.9
    else if (full.startsWith(q) && q.length >= 3) score = 0.85
    else {
      const target = words.find((x) => Math.abs(x.length - q.length) <= 2) ?? full
      const dist = editDistance(q, target)
      const allowed = q.length <= 4 ? 1 : 2
      if (dist <= allowed) score = 0.8 - dist * 0.15
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && full.length < norm(best.name).length))) best = { name: w.name, score }
  }
  return best
}

const DATE_WORDS: Record<string, number> = { today: 0, ngayon: 0, kanina: 0, yesterday: -1, kahapon: -1 }

function decodeDate(spans: Span[], now: Date): string | undefined {
  const span = spans.find((s) => s.entity === 'DATE')
  if (!span) return undefined
  const text = span.text.toLowerCase()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const shift = (days: number) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days))
  for (const [word, days] of Object.entries(DATE_WORDS)) if (text.includes(word)) return shift(days)
  const ago = /(\d+|two|three|dalawang|tatlong)\s+(?:days?|araw)\s+ago/.exec(text)
  if (ago) return shift(-({ two: 2, three: 3, dalawang: 2, tatlong: 3 }[ago[1] as string] ?? Number(ago[1])))
  const WD: Record<string, number> = { sunday: 0, linggo: 0, monday: 1, lunes: 1, tuesday: 2, martes: 2, wednesday: 3, miyerkules: 3, thursday: 4, huwebes: 4, friday: 5, biyernes: 5, saturday: 6, sabado: 6 }
  for (const [name, dow] of Object.entries(WD)) {
    if (text.includes(name)) {
      let back = (now.getDay() - dow + 7) % 7
      if (back === 0) back = 7
      return shift(-back)
    }
  }
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const md = /([a-z]{3})[a-z]*\.?\s+(\d{1,2})/.exec(text)
  if (md && MONTHS.includes(md[1] as string)) {
    const month = MONTHS.indexOf(md[1] as string)
    const day = Number(md[2])
    let year = now.getFullYear()
    if (new Date(year, month, day) > now) year--
    return iso(new Date(year, month, day))
  }
  const numeric = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text)
  if (numeric) {
    const month = Number(numeric[1]) - 1
    const day = Number(numeric[2])
    const year = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : now.getFullYear()
    return iso(new Date(year, month, day))
  }
  const ordinal = /(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)/.exec(text)
  if (ordinal) {
    const day = Number(ordinal[1])
    const d = new Date(now.getFullYear(), now.getMonth(), day)
    if (d > now) d.setMonth(d.getMonth() - 1)
    return iso(d)
  }
  return undefined
}

export function decode(tagged: Tagged, ctx: QuickAddContext): QuickAddResult {
  const { spans } = tagged
  const evidence: string[] = []
  const result: QuickAddResult = { confidence: { amount: 0, type: 0, wallet: 0, category: 0 }, evidence }

  const amounts = spans.filter((s) => s.entity === 'AMOUNT').map((s) => ({ s, value: parseMoneyToken(s.tokens[s.tokens.length - 1]?.text ?? s.text) })).filter((a) => a.value !== null)
  const qty = spans.find((s) => s.entity === 'QTY')
  if (amounts.length) {
    // "split dinner 1200 my share 400": when the message names a share, the share is the amount.
    const text = tagged.tokens.map((t) => t.text.toLowerCase()).join(' ')
    const shareCue = /\b(my share|share ko|akin|hati ko|ako lang)\b/.test(text)
    const chosen = shareCue && amounts.length > 1 ? amounts[amounts.length - 1]! : amounts[0]!
    let value = chosen.value as number
    const q = qty ? parseInt(qty.text.replace(/^x/i, ''), 10) : NaN
    if (qty && Number.isFinite(q) && q > 1 && q <= 50) {
      value = Math.round(value * q * 100) / 100
      evidence.push(`amount ${chosen.s.text} x ${q}`)
    } else evidence.push(shareCue && amounts.length > 1 ? `amount is the share "${chosen.s.text}"` : `amount from "${chosen.s.text}"`)
    result.amount = value
    result.confidence.amount = amounts.length === 1 ? 0.9 : 0.6
  }

  const fee = spans.find((s) => s.entity === 'FEE')
  if (fee) {
    const v = parseMoneyToken(fee.tokens[fee.tokens.length - 1]?.text ?? fee.text)
    if (v !== null) result.serviceFee = v
  }

  const walletSpans = spans.filter((s) => s.entity === 'WALLET')
  const toSpans = spans.filter((s) => s.entity === 'WALLET_TO')
  const from = walletSpans.map((s) => matchWallet(s.text, ctx.wallets)).find(Boolean)
  const to = toSpans.map((s) => matchWallet(s.text, ctx.wallets)).find(Boolean)
  if (from) {
    result.fromWalletName = from.name
    result.confidence.wallet = from.score
    evidence.push(`wallet "${walletSpans[0]?.text}" -> ${from.name} (${from.score.toFixed(2)})`)
  }
  if (to) {
    result.toWalletName = to.name
    evidence.push(`to wallet "${toSpans[0]?.text}" -> ${to.name}`)
  }

  result.type = tagged.type
  result.confidence.type = Math.min(1, Math.max(0.3, tagged.typeMargin / 8))
  if (tagged.type === 'transfer' && !to && from) {
    // "withdrew 5000 gotyme": source known, destination is cash unless the message says otherwise.
    const cash = ctx.wallets.find((w) => (w.type ?? '').toLowerCase() === 'cash' || w.name.toLowerCase() === 'cash')
    if (cash && cash.name !== from.name) result.toWalletName = cash.name
  }

  if (tagged.category && tagged.categoryMargin > 0.5) {
    const known = ctx.categories.find((c) => c.name.toLowerCase() === tagged.category!.toLowerCase())
    if (known) {
      result.inferredCategoryName = known.name
      result.confidence.category = Math.min(1, tagged.categoryMargin / 6)
      evidence.push(`category from "${spans.find((s) => s.entity === 'CAT')?.text}" -> ${known.name}`)
    }
  }

  const date = decodeDate(spans, ctx.now)
  if (date) result.date = date

  const note = spans.find((s) => s.entity === 'NOTE') ?? spans.find((s) => s.entity === 'CAT')
  if (note) result.description = note.text
  return result
}
