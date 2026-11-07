'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, LineChart } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { investmentType } from '@/components/page/investments/investment-meta'
import { useInvestmentValuePoints } from '@/queries/user/investment/value-points'
import type { LiveHolding } from '@/queries/crypto/prices'
import { useSettingsStore } from '@/store/settings-store'
import { cn } from '@/lib/utils'
import { RETURN_PERIODS, portfolioMix, portfolioReturn, type PortfolioHolding, type ReturnPeriod } from '@/utils/portfolio'
import type { Investment, InvestmentType } from '@/types/investment'

const MIX_VIEWS = [
  { value: 'holding', label: 'Holdings' },
  { value: 'type', label: 'Type' },
  { value: 'currency', label: 'Currency' },
] as const
type MixView = (typeof MIX_VIEWS)[number]['value']

const LIMITS = [20, 30, 40, 50]
// Bar colours, largest slice first; the rest share the last one.
const SLICE_COLORS = ['bg-primary', 'bg-success', 'bg-accent', 'bg-warning', 'bg-muted-foreground/40']

const pct = (share: number, digits = 1) => `${(share * 100).toFixed(digits)}%`

/** Returns over a chosen period and how the money is spread, for the Insights investing section. */
export function PortfolioCard({
  investments,
  liveById,
  money,
  loading,
}: {
  investments: Investment[]
  liveById: Record<string, LiveHolding>
  money: (value: number) => string
  loading?: boolean
}) {
  const limitPercent = useSettingsStore((s) => s.concentrationLimit ?? 30)
  const setLimit = useSettingsStore((s) => s.setConcentrationLimit)
  const [period, setPeriod] = useState<ReturnPeriod>('1m')
  const [view, setView] = useState<MixView>('holding')
  const { data: points, isLoading: pointsLoading } = useInvestmentValuePoints()

  const holdings: PortfolioHolding[] = useMemo(
    () =>
      investments.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        currency: i.currency,
        principal: Number(i.principalAmount) || 0,
        value: liveById[i.id]?.value ?? (Number(i.currentValue) || 0),
        dividends: Number(i.dividendsReceived) || 0,
        startDate: i.startDate,
        status: i.status,
        live: i.type === 'crypto' && !!i.coinId && Number(i.quantity) > 0,
      })),
    [investments, liveById]
  )

  const result = useMemo(() => portfolioReturn(holdings, points ?? [], period), [holdings, points, period])
  const mix = useMemo(
    () => portfolioMix(holdings, limitPercent / 100, (t) => investmentType(t as InvestmentType).label),
    [holdings, limitPercent]
  )
  const slices = view === 'holding' ? mix.byHolding : view === 'type' ? mix.byType : mix.byCurrency
  const top = slices.slice(0, 4)
  const rest = slices.slice(4).reduce((s, x) => ({ value: s.value + x.value, share: s.share + x.share }), { value: 0, share: 0 })
  const shown = rest.share > 0 ? [...top, { key: 'rest', label: `${slices.length - 4} more`, value: rest.value, share: rest.share }] : top

  const up = result.gain >= 0
  const busy = loading || (pointsLoading && period !== 'all')

  return (
    <article id="portfolio" className="scroll-mt-28 rounded-2xl border border-border bg-card p-4 shadow-ios">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
          <LineChart className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Portfolio returns</h3>
      </div>

      <div role="radiogroup" aria-label="Return period" className="mt-3 flex gap-1 rounded-full bg-secondary p-1">
        {RETURN_PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'min-w-0 flex-1 rounded-full px-1.5 py-1.5 text-xs font-semibold transition-colors',
              period === p.value ? 'bg-card text-foreground shadow-ios' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {busy ? (
        <Skeleton className="mt-3 h-12 w-40" />
      ) : (
        <div className="mt-3">
          <p className="flex flex-wrap items-baseline gap-x-2 font-heading text-2xl font-semibold tabular-nums text-foreground">
            <span>
              {up ? '+' : '-'}
              {money(Math.abs(result.gain))}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', up ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')}>
              {up ? '+' : ''}
              {pct(result.rate)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {period === 'all'
              ? `On ${money(result.contributions)} put in, including ${money(result.dividends)} in returns received.`
              : `On ${money(result.start + result.contributions)} at work${result.contributions > 0 ? `, ${money(result.contributions)} of it added in this period` : ''}.`}
            {result.missing.length > 0 && ` Leaves out ${result.missing.join(', ')}: no price from back then yet.`}
          </p>
        </div>
      )}

      {mix.total > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mix</h4>
            <div role="radiogroup" aria-label="Group the mix by" className="flex gap-1">
              {MIX_VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={view === v.value}
                  onClick={() => setView(v.value)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                    view === v.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
            {shown.map((s, i) => (
              <span key={s.key} className={cn('h-full', SLICE_COLORS[Math.min(i, SLICE_COLORS.length - 1)])} style={{ width: `${s.share * 100}%` }} />
            ))}
          </div>
          <ul className="mt-2 space-y-1.5">
            {shown.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span className={cn('size-2.5 shrink-0 rounded-full', SLICE_COLORS[Math.min(i, SLICE_COLORS.length - 1)])} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{money(s.value)}</span>
                <span className="w-12 text-right font-semibold tabular-nums text-foreground">{pct(s.share, 0)}</span>
              </li>
            ))}
          </ul>

          {mix.concentrated.length > 0 && (
            <p className="mt-3 flex gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              <span>
                {mix.concentrated.map((s) => `${s.label} is ${pct(s.share, 0)}`).join(', ')} of your investments, above your {limitPercent}% limit. A big drop there
                would hit the whole portfolio.
              </span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Warn above</span>
            {LIMITS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={limitPercent === l}
                onClick={() => setLimit(l)}
                className={cn('rounded-full px-2 py-0.5 font-semibold transition-colors', limitPercent === l ? 'bg-secondary text-foreground' : 'hover:text-foreground')}
              >
                {l}%
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
