// Portfolio returns over a period, and how concentrated the holdings are.
//
// Returns: each holding's value at the start of the period comes from its value history: the amount
// put in on its start date, every value update (investment_value_snapshots) and, for crypto, the
// daily price snapshots the server's price job writes. Between points the value is taken as the last
// known one, which is exactly what the app showed at the time. A holding started inside the period
// counts its amount put in as a contribution, not a gain:
//   gain = value now − value at start − put in during the period
//   rate = gain ÷ (value at start + put in during the period)
// Live-priced crypto moves all the time, so if its last point before the period is older than the
// period itself, its start value is unknown and it is left out (and counted in `missing`).
// "All" is the plain lifetime figure: value now − amount put in + returns received.

import type { InvestmentType } from '@/types/investment'

export type ReturnPeriod = 'today' | '1w' | '1m' | 'ytd' | '1y' | 'all'

export const RETURN_PERIODS: { value: ReturnPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

export interface PortfolioHolding {
  id: string
  name: string
  type: InvestmentType | string
  currency: string
  /** Amount put in (the cost basis). */
  principal: number
  /** Value now, live for crypto. */
  value: number
  /** Returns received so far (dividends, interest paid out). */
  dividends: number
  /** When the money went in (ISO date or timestamp). */
  startDate: string
  status: string
  /** True for crypto valued from a live price, whose value moves between recorded points. */
  live?: boolean
}

export interface ValuePoint {
  investmentId: string
  date: string
  value: number
}

export interface PeriodReturn {
  period: ReturnPeriod
  /** Value of the counted holdings at the start of the period. */
  start: number
  /** Amount put in during the period (holdings started inside it). */
  contributions: number
  /** Value of the counted holdings now. */
  end: number
  /** Returns received; only part of "All". */
  dividends: number
  gain: number
  /** Gain as a share of what was at work (start + contributions), e.g. 0.052 for 5.2%. */
  rate: number
  /** Holdings counted. */
  counted: number
  /** Holdings left out because their value at the start is unknown. */
  missing: string[]
}

const DAY = 86_400_000

/** Start of the period, in local time. Null for "All". */
export function periodStart(period: ReturnPeriod, now: Date): Date | null {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case 'today':
      return midnight
    case '1w':
      return new Date(midnight.getTime() - 7 * DAY)
    case '1m':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1)
    case '1y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    case 'all':
      return null
  }
}

const isOpen = (h: PortfolioHolding) => h.status !== 'sold' && h.status !== 'archived'
const time = (iso: string) => new Date(iso).getTime()

export function portfolioReturn(holdings: PortfolioHolding[], points: ValuePoint[], period: ReturnPeriod, now = new Date()): PeriodReturn {
  const open = holdings.filter(isOpen)
  const empty = { period, start: 0, contributions: 0, end: 0, dividends: 0, gain: 0, rate: 0, counted: 0, missing: [] as string[] }

  if (period === 'all') {
    const principal = open.reduce((s, h) => s + h.principal, 0)
    const end = open.reduce((s, h) => s + h.value, 0)
    const dividends = open.reduce((s, h) => s + h.dividends, 0)
    const gain = end - principal + dividends
    return { ...empty, contributions: principal, end, dividends, gain, rate: principal > 0 ? gain / principal : 0, counted: open.length }
  }

  const from = periodStart(period, now)!.getTime()
  const span = now.getTime() - from
  const byHolding = new Map<string, ValuePoint[]>()
  for (const p of points) byHolding.set(p.investmentId, [...(byHolding.get(p.investmentId) ?? []), p])

  const result = { ...empty }
  for (const h of open) {
    if (time(h.startDate) > from) {
      result.contributions += h.principal
      result.end += h.value
      result.counted++
      continue
    }
    const series = [{ investmentId: h.id, date: h.startDate, value: h.principal }, ...(byHolding.get(h.id) ?? [])]
      .filter((p) => time(p.date) <= from)
      .sort((a, b) => time(a.date) - time(b.date))
    const last = series[series.length - 1]
    if (h.live && from - time(last.date) > Math.max(span, DAY)) {
      result.missing.push(h.name)
      continue
    }
    result.start += last.value
    result.end += h.value
    result.counted++
  }
  result.gain = result.end - result.start - result.contributions
  const atWork = result.start + result.contributions
  result.rate = atWork > 0 ? result.gain / atWork : 0
  return result
}

export interface MixSlice {
  key: string
  label: string
  value: number
  share: number
}

export interface PortfolioMix {
  total: number
  byHolding: MixSlice[]
  byType: MixSlice[]
  byCurrency: MixSlice[]
  /** Holdings above the limit, largest first. */
  concentrated: MixSlice[]
}

/** Share of the total per holding, per type and per currency. `limit` is a share, e.g. 0.3 for 30%. */
export function portfolioMix(holdings: PortfolioHolding[], limit = 0.3, typeLabel: (type: string) => string = (t) => t): PortfolioMix {
  const open = holdings.filter((h) => isOpen(h) && h.value > 0)
  const total = open.reduce((s, h) => s + h.value, 0)
  const slices = (key: (h: PortfolioHolding) => string, label: (k: string, h: PortfolioHolding) => string) => {
    const map = new Map<string, MixSlice>()
    for (const h of open) {
      const k = key(h)
      const slice = map.get(k) ?? { key: k, label: label(k, h), value: 0, share: 0 }
      slice.value += h.value
      map.set(k, slice)
    }
    return [...map.values()].map((s) => ({ ...s, share: total > 0 ? s.value / total : 0 })).sort((a, b) => b.value - a.value)
  }
  const byHolding = slices((h) => h.id, (_, h) => h.name)
  return {
    total,
    byHolding,
    byType: slices((h) => String(h.type), (k) => typeLabel(k)),
    byCurrency: slices((h) => (h.currency || 'PHP').toUpperCase(), (k) => k),
    // One holding is always 100%; a warning only means something when there is a choice.
    concentrated: byHolding.length > 1 ? byHolding.filter((s) => s.share > limit) : [],
  }
}
