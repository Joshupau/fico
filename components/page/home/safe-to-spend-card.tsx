'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsStore } from '@/store/settings-store'
import type { SafeToSpend } from '@/utils/safe-to-spend'

const RING = 2 * Math.PI * 42

/** Today's allowance as a ring that empties as you spend, with payday and the money kept aside. */
export function SafeToSpendBody({
  result,
  loading,
  money,
  spentToday,
}: {
  result: SafeToSpend | null
  loading: boolean
  money: (n: number) => string
  spentToday: number
}) {
  const floor = useSettingsStore((s) => s.safeToSpendFloor)
  const setFloor = useSettingsStore((s) => s.setSafeToSpendFloor)
  const [editing, setEditing] = useState(false)
  const [floorText, setFloorText] = useState('')

  if (loading) return <Skeleton className="h-32 rounded-2xl" />
  if (!result) return <p className="py-4 text-center text-sm text-muted-foreground">Can't work this out right now. Check your connection and try again.</p>

  const left = Math.round(result.leftToday)
  const over = left < 0
  // Share of today's allowance still left. Empty when over pace or short.
  const share = result.perDay > 0 ? Math.min(1, Math.max(0, result.leftToday / result.perDay)) : 0
  const tone = result.short || over ? 'text-destructive' : share < 0.25 ? 'text-warning' : 'text-success'
  const centre = money(result.short ? Math.round(Math.abs(result.usable)) : Math.abs(left))
  const payday = result.nextIncomeDate ? parseISO(result.nextIncomeDate) : null

  const saveFloor = () => {
    const value = Number(floorText.replace(/[^0-9.]/g, ''))
    setFloor(Number.isFinite(value) ? value : 0)
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-secondary" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - share)}
              className={`stroke-current transition-[stroke-dashoffset] duration-500 ${tone}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
            <span
              className={`font-heading font-bold tabular-nums ${centre.length > 9 ? 'text-sm' : 'text-lg'} ${over || result.short ? 'text-destructive' : 'text-foreground'}`}
            >
              {centre}
            </span>
            <span className="text-[11px] text-muted-foreground">{result.short ? 'short' : over ? 'over today' : 'left today'}</span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Per day</dt>
            <dd className="font-semibold tabular-nums text-foreground">{money(Math.round(result.perDay))}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Spent today</dt>
            <dd className="font-semibold tabular-nums text-foreground">{money(spentToday)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{payday ? 'Next payday' : 'Until'}</dt>
            <dd className="truncate font-semibold text-foreground">
              {payday ? format(payday, 'MMM d') : 'month end'}
              <span className="font-normal text-muted-foreground"> · {result.days}d</span>
            </dd>
          </div>
          {result.billsBefore > 0 && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Bills before then</dt>
              <dd className="font-semibold tabular-nums text-foreground">{money(result.billsBefore)}</dd>
            </div>
          )}
        </dl>
      </div>

      {result.short && (
        <p className="mt-3 rounded-2xl bg-destructive/10 p-2.5 text-sm font-medium text-destructive">
          Bills before {payday ? 'payday' : 'month end'} are {money(Math.abs(result.usable))} more than your cash.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
        {editing ? (
          <form
            className="flex w-full items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              saveFloor()
            }}
          >
            <label htmlFor="safe-floor" className="shrink-0 text-muted-foreground">
              Keep aside
            </label>
            <input
              id="safe-floor"
              autoFocus
              inputMode="decimal"
              value={floorText}
              onChange={(e) => setFloorText(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 tabular-nums text-foreground outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFloorText(floor > 0 ? String(floor) : '')
              setEditing(true)
            }}
            className="flex w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
          >
            <span>
              {floor > 0 ? (
                <>
                  Keeping <span className="font-semibold text-foreground">{money(floor)}</span> aside
                </>
              ) : (
                'Set money to keep aside'
              )}
            </span>
            <Pencil className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

