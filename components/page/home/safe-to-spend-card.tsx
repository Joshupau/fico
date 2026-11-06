'use client'

import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { Pencil } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsStore } from '@/store/settings-store'
import { walletCounts, type SafeToSpend } from '@/utils/safe-to-spend'
import { SafeToSpendWalletsSheet } from '@/components/page/home/safe-to-spend-wallets-sheet'

const RING = 2 * Math.PI * 42
const SHOWN_BILLS = 3

/**
 * The bills (and planned expenses) due before payday, which are already taken out of "Until payday",
 * so you can see what that money is set aside for. With none due, it names the next one after payday.
 */
function BillsBefore({ result, money, payday }: { result: SafeToSpend; money: (n: number) => string; payday: Date | null }) {
  const today = startOfDay(new Date())
  const until = payday ? 'payday' : 'month end'
  const next = result.nextBill
  const nextLine = next && (
    <>
      {result.billsDue.length ? 'Next after ' + until : 'Next'}: <span className="text-foreground">{next.name || 'Bill'}</span>{' '}
      <span className="whitespace-nowrap">{money(Math.round(next.amount))} on {format(parseISO(next.dueDate), 'MMM d')}</span>
    </>
  )

  if (!result.billsDue.length) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        No bills due before {until}.{nextLine && <> {nextLine}</>}
      </p>
    )
  }

  const shown = result.billsDue.slice(0, SHOWN_BILLS)
  const more = result.billsDue.length - shown.length
  return (
    <div className="mt-3 border-t border-border pt-3 text-sm">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Bills before {until}</span>
        <span className="font-semibold tabular-nums text-foreground">{money(Math.round(result.billsBefore))}</span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {shown.map((bill, i) => {
          const due = parseISO(bill.dueDate)
          const overdue = differenceInCalendarDays(due, today) < 0
          return (
            <li key={`${bill.dueDate}-${i}`} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-foreground">
                {bill.name || 'Bill'}
                <span className={overdue ? 'text-destructive' : 'text-muted-foreground'}>
                  {' · '}
                  {overdue ? 'overdue' : format(due, 'MMM d')}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">{money(Math.round(bill.amount))}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {more > 0 && <>+{more} more · </>}
        Already taken out of until {until}.{nextLine && <> {nextLine}</>}
      </p>
    </div>
  )
}

/** Today's allowance as a ring that empties as you spend, with payday and the money kept aside. */
export function SafeToSpendBody({
  result,
  loading,
  money,
  spentToday,
  wallets,
}: {
  result: SafeToSpend | null
  loading: boolean
  money: (n: number) => string
  spentToday: number
  wallets: any[]
}) {
  const floor = useSettingsStore((s) => s.safeToSpendFloor)
  const rules = useSettingsStore((s) => s.safeToSpendWallets)
  const [sheetOpen, setSheetOpen] = useState(false)
  const active = wallets.filter((w) => w.status !== 'archived')
  const countedWallets = active.filter((w) => walletCounts(w, rules?.[String(w._id ?? w.id ?? '')]))
  const counted = countedWallets.map((w) => String(w.name))
  const kept =
    floor +
    countedWallets.reduce((sum, w) => sum + Math.min(Number(w.balance) || 0, Number(rules?.[String(w._id ?? w.id ?? '')]?.min) || 0), 0)

  if (loading) return <Skeleton className="h-32 rounded-2xl" />
  if (!result) return <p className="py-4 text-center text-sm text-muted-foreground">Can't work this out right now. Check your connection and try again.</p>

  const left = Math.round(result.leftToday)
  const over = left < 0
  // Share of today's allowance still left. Empty when over pace or short.
  const share = result.perDay > 0 ? Math.min(1, Math.max(0, result.leftToday / result.perDay)) : 0
  const tone = result.short || over ? 'text-destructive' : share < 0.25 ? 'text-warning' : 'text-success'
  const centre = money(result.short ? Math.round(Math.abs(result.usable)) : Math.abs(left))
  const payday = result.nextIncomeDate ? parseISO(result.nextIncomeDate) : null

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
            <dt className="text-muted-foreground">{payday ? 'Until payday' : 'Until month end'}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{money(Math.max(0, Math.round(result.usable)))}</dd>
          </div>
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
        </dl>
      </div>

      <BillsBefore result={result} money={money} payday={payday} />

      {result.short && (
        <p className="mt-3 rounded-2xl bg-destructive/10 p-2.5 text-sm font-medium text-destructive">
          Bills before {payday ? 'payday' : 'month end'} are {money(Math.abs(result.usable))} more than your cash.
        </p>
      )}

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mt-3 flex w-full items-center justify-between gap-2 border-t border-border pt-3 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <span className="min-w-0">
          <span className="block truncate">
            From <span className="font-semibold text-foreground">{counted.length ? counted.join(', ') : 'no wallets'}</span>
          </span>
          {kept > 0 && <span className="block text-xs">Keeping {money(kept)} in minimums and aside</span>}
        </span>
        <Pencil className="h-4 w-4 shrink-0" />
      </button>
      <SafeToSpendWalletsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} wallets={wallets} money={money} />
    </div>
  )
}

