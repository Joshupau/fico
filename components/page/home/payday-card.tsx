'use client'

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, startOfDay } from 'date-fns'
import { PartyPopper, X } from 'lucide-react'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { paydayToday } from '@/utils/retention'
import type { SafeToSpend } from '@/utils/safe-to-spend'

/* eslint-disable @typescript-eslint/no-explicit-any -- list rows come back untyped, as elsewhere on Home */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
const dismissKey = (day: string) => `fico:payday-seen:${day}`

const readDismissed = (day: string) => {
  try {
    return window.localStorage.getItem(dismissKey(day)) === '1'
  } catch {
    return false
  }
}

/**
 * Shows on payday, once your pay is recorded (an income bill marked received, or income that reads
 * like salary): how much came in, what is safe to spend until the next one, and where to put it.
 */
export function PaydayCard({ money, safe }: { money: (n: number) => string; safe: SafeToSpend | null }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const day = format(today, 'yyyy-MM-dd')
  const [dismissed, setDismissed] = useState(() => readDismissed(day))
  const { data } = useListTransactions({ type: 'income', startDate: today.toISOString(), limit: '50' })

  const pay = useMemo(
    () =>
      paydayToday(
        asList(data?.data)
          .filter((t: any) => t.type === 'income' && t.status !== 'pending' && !t.obligationId)
          .map((t: any) => ({ amount: Number(t.amount) || 0, description: t.description, billId: t.billId ?? t.bill?._id ?? null }))
      ),
    [data]
  )
  if (!pay || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(dismissKey(day), '1')
    } catch {
      // Storage blocked: it just shows again next time.
    }
  }
  const next = safe?.nextIncomeDate ? format(parseISO(safe.nextIncomeDate), 'MMM d') : null

  return (
    <section className="relative mt-4 overflow-hidden rounded-3xl border border-success/30 bg-success/10 p-4 shadow-ios sm:p-5" aria-label="Payday">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-card/60">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-success/20 text-success">
          <PartyPopper className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-foreground">Your sahod is in</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{money(pay.amount)}</span> arrived today.
            {safe && !safe.short && (
              <>
                {' '}
                Safe to spend until {next ?? 'month end'}: <span className="font-semibold tabular-nums text-foreground">{money(safe.usable)}</span>, about{' '}
                <span className="font-semibold tabular-nums text-foreground">{money(safe.perDay)}</span> a day.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/goals" className="rounded-full bg-success px-4 py-2 text-sm font-semibold text-success-foreground">
          Save for a goal first
        </Link>
        <Link to="/budgets" className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
          Plan this pay
        </Link>
      </div>
    </section>
  )
}
