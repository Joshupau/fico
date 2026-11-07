'use client'

import { useMemo, useState } from 'react'
import { addDays, format, isAfter, isSameDay, startOfDay, startOfWeek, subWeeks } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useSettingsStore } from '@/store/settings-store'
import { walletCounts } from '@/utils/safe-to-spend'

const WEEKS = 5
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
// Empty day, then four shades of the primary colour from light to full.
const SHADES = ['bg-secondary', 'bg-primary/20', 'bg-primary/45', 'bg-primary/70', 'bg-primary']

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * The last few weeks of spending, one square per day, darker on bigger days. Counts the same money as
 * Spent today: expenses only, no lending or repayments, and nothing from wallets turned off in
 * Spending wallets (cards and wallets no longer listed still count).
 */
export function WeeklySpendingHeatmap({ money }: { money: (n: number) => string }) {
  const rules = useSettingsStore((s) => s.safeToSpendWallets)
  const today = useMemo(() => startOfDay(new Date()), [])
  const firstDay = useMemo(() => subWeeks(startOfWeek(today, { weekStartsOn: 1 }), WEEKS - 1), [today])
  const [selected, setSelected] = useState<string | null>(null)

  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets({ limit: '100' })
  const { data: txResponse, isLoading: txLoading } = useListTransactions({
    type: 'expense',
    startDate: firstDay.toISOString(),
    limit: '1000',
  })

  const totals = useMemo(() => {
    const byId = new Map(asList(walletsResponse?.data).map((w: any) => [String(w._id ?? w.id ?? ''), w]))
    const map = new Map<string, number>()
    for (const t of asList(txResponse?.data)) {
      if (t.type !== 'expense' || t.obligationId) continue
      const walletId = String(t.walletId ?? t.wallet?._id ?? '')
      const wallet = byId.get(walletId)
      if (wallet && wallet.type !== 'credit_card' && !walletCounts(wallet, rules?.[walletId])) continue
      const key = dayKey(new Date(t.date || t.createdAt))
      map.set(key, (map.get(key) ?? 0) + (Number(t.amount) || 0))
    }
    return map
  }, [txResponse, walletsResponse, rules])

  const weeks = useMemo(
    () => Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstDay, w * 7 + d))),
    [firstDay]
  )
  const max = Math.max(0, ...totals.values())
  // Square-root scale so one big day doesn't wash every other day out to the lightest shade.
  const shadeFor = (amount: number) => (amount <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil(Math.sqrt(amount / max) * 4)))
  const weekTotal = (week: Date[]) => week.reduce((sum, d) => sum + (totals.get(dayKey(d)) ?? 0), 0)
  const thisWeek = weekTotal(weeks[WEEKS - 1])
  const lastWeek = weekTotal(weeks[WEEKS - 2])

  if (txLoading || walletsLoading) return <Skeleton className="h-56 rounded-2xl" />

  const selectedDate = selected ? weeks.flat().find((d) => dayKey(d) === selected) : null
  const diff = thisWeek - lastWeek

  return (
    <div>
      <div className="mb-4 min-h-[2.75rem]">
        {selectedDate ? (
          <>
            <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{money(totals.get(selected!) ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Spent on {format(selectedDate, 'EEEE, MMM d')}</p>
          </>
        ) : (
          <>
            <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{money(thisWeek)}</p>
            <p className="text-xs text-muted-foreground">
              Spent this week
              {lastWeek > 0 && Math.round(diff) !== 0 && (
                <>
                  {', '}
                  <span className={diff > 0 ? 'text-warning' : 'text-success'}>
                    {money(Math.abs(diff))} {diff > 0 ? 'more' : 'less'}
                  </span>{' '}
                  than last week
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Daily spending, last five weeks">
        {DAY_LETTERS.map((letter, i) => (
          <span key={i} className="pb-0.5 text-center text-[11px] font-semibold text-muted-foreground">
            {letter}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const key = dayKey(day)
          const future = isAfter(day, today)
          const amount = totals.get(key) ?? 0
          const isToday = isSameDay(day, today)
          const isSelected = selected === key
          if (future) return <span key={key} className="aspect-square rounded-lg border border-dashed border-border/60" />
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(isSelected ? null : key)}
              aria-label={`${format(day, 'EEEE, MMM d')}: ${money(amount)}`}
              aria-pressed={isSelected}
              className={`aspect-square rounded-lg transition-transform active:scale-95 ${SHADES[shadeFor(amount)]} ${
                isSelected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
              }`}
            />
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{format(firstDay, 'MMM d')} to today</span>
        <span className="flex items-center gap-1">
          Less
          {SHADES.map((shade) => (
            <span key={shade} className={`h-2.5 w-2.5 rounded-[3px] ${shade}`} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
