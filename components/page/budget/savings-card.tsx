'use client'

import { PiggyBank, ArrowDownToLine, CalendarClock, Target } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { SavingsSummary } from '@/utils/budget-plans'

interface SavingsCardProps {
  summary: SavingsSummary
  monthLabel: string
  isPastMonth: boolean
  hasSavingsWallets: boolean
  loading?: boolean
}

/** How much you can save this month: income minus what your budgets let you spend, and what you already saved. */
export function SavingsCard({ summary, monthLabel, isPastMonth, hasSavingsWallets, loading }: SavingsCardProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (value: number) => formatMoney(value, currency, hideAmountsOnOpen)
  const { income, received, stillDue, budgeted, canSave, savedSoFar } = summary
  const short = canSave < 0
  const savedPct = canSave > 0 ? Math.min(100, (Math.max(0, savedSoFar) / canSave) * 100) : 0

  if (loading) {
    return (
      <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-ios" aria-label="Loading">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-3 h-10 w-56" />
        <Skeleton className="mt-3 h-3.5 w-72 max-w-full" />
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const message = (() => {
    if (income <= 0) return 'Log your income or add it on the Bills page, and Fico will show how much you can save.'
    if (short) return `Your budgets are ${money(Math.abs(canSave))} more than your income ${isPastMonth ? 'was' : 'this month'}.`
    if (isPastMonth) return `You had ${money(canSave)} left after your budgets in ${monthLabel}.`
    return `Stay within your budgets and ${money(canSave)} is left to save.`
  })()

  const tiles = [
    { label: isPastMonth ? 'Income' : 'Income so far', value: money(received), icon: ArrowDownToLine, tone: 'text-success', bg: 'bg-success/10' },
    { label: 'Income still due', value: money(stillDue), icon: CalendarClock, tone: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Budgeted', value: money(budgeted), icon: Target, tone: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Saved so far', value: hasSavingsWallets ? money(savedSoFar) : 'No savings wallet', icon: PiggyBank, tone: 'text-accent', bg: 'bg-accent/10' },
  ]

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-ios md:p-8">
      <div className="absolute right-0 top-0 -mr-24 -mt-24 h-48 w-48 rounded-full bg-success/5 blur-3xl" />
      <div className="relative z-10 grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-8">
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <PiggyBank className="h-4 w-4 text-success" />
            You can save in {monthLabel}
          </h3>
          <p className={`text-4xl font-black ${short ? 'text-destructive' : 'text-foreground'}`}>{money(canSave)}</p>
          <p className="text-sm text-muted-foreground">
            {money(income)} income − {money(budgeted)} budgets
          </p>
          {canSave > 0 && hasSavingsWallets && (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${savedPct}%` }} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {money(Math.max(0, savedSoFar))} moved to savings ({savedPct.toFixed(0)}%)
              </p>
            </div>
          )}
          <p className={`text-sm font-medium ${short ? 'text-destructive' : 'text-success'}`}>{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-border/50 bg-secondary/40 p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${tile.bg}`}>
                  <tile.icon className={`h-4 w-4 ${tile.tone}`} />
                </div>
                <span className="text-xs font-semibold uppercase text-muted-foreground">{tile.label}</span>
              </div>
              <p className="break-words text-lg font-bold text-foreground">{tile.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
