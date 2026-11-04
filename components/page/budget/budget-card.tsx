'use client'

import { Trash2, Edit2, RotateCcw, AlertTriangle, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface BudgetCardProps {
  id: string
  name: string
  amount: number
  spent: number
  remaining: number
  period: string
  alertThreshold: number
  categories?: { id: string; name: string; color: string }[]
  percentageUsed: number
  isOverBudget: boolean
  isNearThreshold: boolean
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onRollover?: (id: string) => void
  /** Yearly budgets: spending inside the month being viewed. */
  monthSpent?: number
  monthLabel?: string
}

export function BudgetCard({
  id,
  name,
  amount,
  spent,
  remaining,
  period,
  alertThreshold,
  categories = [],
  percentageUsed,
  isOverBudget,
  isNearThreshold,
  onEdit,
  onArchive,
  onRollover,
  monthSpent,
  monthLabel,
}: BudgetCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const { currency } = useSettingsStore()

  const formatValue = (val: number) => {
    return formatMoney(val, currency, false)
  }

  const getProgressColor = () => {
    if (isOverBudget) return 'bg-destructive'
    if (isNearThreshold) return 'bg-warning'
    return 'bg-success'
  }

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 shadow-ios">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ backgroundColor: categories[0]?.color || '#6366f1' }}
        >
          {name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight text-foreground">{name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {categories.length > 0 ? categories.map((c) => c.name).join(', ') : period}
            {period === 'yearly' ? ' · yearly' : ''}
          </p>
        </div>

        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMenu(!showMenu)}
            aria-label={`Options for ${name}`}
            className="h-8 w-8 rounded-full hover:bg-secondary"
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </Button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-card py-2 shadow-xl animate-in fade-in zoom-in duration-200">
                <button
                  onClick={() => { onEdit?.(id); setShowMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit budget
                </button>
                <button
                  onClick={() => { onRollover?.(id); setShowMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rollover
                </button>
                <hr className="my-1 border-border/50" />
                <button
                  onClick={() => { onArchive?.(id); setShowMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-secondary"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Budget
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all duration-700 ${getProgressColor()}`} style={{ width: `${Math.min(percentageUsed, 100)}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          <span className={`font-semibold ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>{formatValue(spent)}</span> of {formatValue(amount)}
          {monthSpent !== undefined ? ` · ${monthLabel}: ${formatValue(monthSpent)}` : ''}
        </span>
        <span className={`flex shrink-0 items-center gap-1 font-medium tabular-nums ${isOverBudget ? 'text-destructive' : isNearThreshold ? 'text-warning' : 'text-success'}`}>
          {(isOverBudget || isNearThreshold) && <AlertTriangle className="h-3.5 w-3.5" />}
          {isOverBudget ? `${formatValue(Math.abs(remaining))} over` : `${formatValue(remaining)} left`}
        </span>
      </div>
    </div>
  )
}
