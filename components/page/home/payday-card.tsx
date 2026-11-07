'use client'

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, startOfDay } from 'date-fns'
import { PartyPopper, PiggyBank, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { createTransaction, invalidateTransactionAndWalletQueries, useListTransactions } from '@/queries/user/transaction/transaction'
import { useListGoals } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { asGoalWallets, goalProgress } from '@/components/page/goals/goal-progress'
import { useGoalMilestones } from '@/hooks/use-milestones'
import { paydayContributions } from '@/utils/goal-funding'
import { paydayToday } from '@/utils/retention'
import type { SafeToSpend } from '@/utils/safe-to-spend'

/* eslint-disable @typescript-eslint/no-explicit-any -- list rows come back untyped, as elsewhere on Home */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
const dismissKey = (day: string) => `fico:payday-seen:${day}`
const fundedKey = (day: string) => `fico:payday-funded:${day}`

const readFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const writeFlag = (key: string) => {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Storage blocked: it just shows again next time.
  }
}

/**
 * Shows on payday, once your pay is recorded (an income bill marked received, or income that reads
 * like salary): how much came in, what is safe to spend until the next one, and where to put it.
 */
export function PaydayCard({ money, safe }: { money: (n: number) => string; safe: SafeToSpend | null }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const day = format(today, 'yyyy-MM-dd')
  const [dismissed, setDismissed] = useState(() => readFlag(dismissKey(day)))
  const [funded, setFunded] = useState(() => readFlag(fundedKey(day)))
  const [moving, setMoving] = useState(false)
  const queryClient = useQueryClient()
  const celebrateGoals = useGoalMilestones()
  const { data } = useListTransactions({ type: 'income', startDate: today.toISOString(), limit: '50' })
  const { data: goalsResponse } = useListGoals()
  const { data: walletsResponse } = useListWallets({ limit: '100' })

  const { pay, payWalletId } = useMemo(() => {
    const incomes = asList(data?.data).filter((t: any) => t.type === 'income' && t.status !== 'pending' && !t.obligationId)
    const rows = incomes.map((t: any) => ({ amount: Number(t.amount) || 0, description: t.description, billId: t.billId ?? t.bill?._id ?? null, walletId: String(t.walletId ?? t.wallet?._id ?? '') }))
    const result = paydayToday(rows)
    // The goal money goes out from the wallet that got the biggest pay today.
    const biggest = result ? rows.filter((r) => paydayToday([r])).sort((a, b) => b.amount - a.amount)[0] : null
    return { pay: result, payWalletId: biggest?.walletId || null }
  }, [data])

  const contributions = useMemo(() => {
    if (!pay) return []
    const wallets = asGoalWallets(walletsResponse?.data)
    const goals = (goalsResponse?.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      target: Number(g.targetAmount) || 0,
      saved: goalProgress(g, wallets).saved,
      funding: g.funding,
      linkedWalletIds: g.linkedWalletIds ?? [],
    }))
    return paydayContributions(pay.amount, goals, payWalletId)
  }, [pay, payWalletId, goalsResponse, walletsResponse])

  if (!pay || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    writeFlag(dismissKey(day))
  }

  const fundGoals = async () => {
    if (!payWalletId || moving) return
    setMoving(true)
    const deltas: Record<string, number> = {}
    try {
      for (const c of contributions) {
        await createTransaction({ walletId: payWalletId, toWalletId: c.toWalletId, amount: c.amount, type: 'transfer', description: `Payday: ${c.goalName}` })
        deltas[c.toWalletId] = (deltas[c.toWalletId] ?? 0) + c.amount
        deltas[payWalletId] = (deltas[payWalletId] ?? 0) - c.amount
      }
      setFunded(true)
      writeFlag(fundedKey(day))
      invalidateTransactionAndWalletQueries(queryClient)
      const shown = await celebrateGoals(deltas)
      if (!shown.length) toast.success('Moved to your goals')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not move the money')
      invalidateTransactionAndWalletQueries(queryClient)
    } finally {
      setMoving(false)
    }
  }
  const goalTotal = contributions.reduce((s, c) => s + c.amount, 0)
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
      {contributions.length > 0 && !funded && payWalletId && (
        <div className="mt-3 rounded-2xl bg-card/70 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5" /> For your goals
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {contributions.map((c) => (
              <li key={c.goalId} className="flex justify-between gap-3">
                <span className="truncate text-foreground">{c.goalName}</span>
                <span className="font-semibold tabular-nums text-foreground">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={fundGoals} disabled={moving} className="mt-2.5 w-full rounded-full bg-success py-2.5 text-sm font-semibold text-success-foreground disabled:opacity-60">
            {moving ? 'Moving…' : `Move ${money(goalTotal)} now`}
          </button>
        </div>
      )}
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
