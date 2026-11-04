'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ChevronRight, CalendarClock, CreditCard, Gift, HandCoins, PiggyBank, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BudgetOverview } from '@/components/page/budget/budget-overview'
import { SavingsCard } from '@/components/page/budget/savings-card'
import { asGoalWallets, goalProgress } from '@/components/page/goals/goal-progress'
import { extractItemsCount, normalizeBillSummary } from '@/components/page/bills/bill-utils'
import { useBudgetMonth } from '@/hooks/use-budget-month'
import { useBudgetPerformance, useBudgetSummary } from '@/queries/user/budget/budgets'
import { useBillSummary, useOverdueBills, useUpcomingBills } from '@/queries/user/bill/bills'
import { useListGoals } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useObligationSummary } from '@/queries/user/obligation/obligations'
import { useListWishlist } from '@/queries/user/wishlist/wishlist'
import { useInvestmentSummary, useListInvestments } from '@/queries/user/investment/investments'
import { useLiveHoldings } from '@/queries/crypto/prices'
import { useListPlannedItems } from '@/queries/user/planned/planned-items'
import { useSettingsStore } from '@/store/settings-store'
import { startOfMonth } from '@/utils/budget-month'
import { formatMoney } from '@/utils/formatter'
import type { Investment } from '@/types/investment'

const DAYS_PER_MONTH = 365.25 / 12
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.wallets) ? data.wallets : [])

interface SummaryCardProps {
  title: string
  href: string
  icon: LucideIcon
  tone: string
  loading?: boolean
  value: string
  /** A few small figures under the main number. */
  details: { label: string; value: string; tone?: string }[]
  hint?: string
}

/** One area of the app (bills, goals, ...) in a small card that opens its page. */
function SummaryCard({ title, href, icon: Icon, tone, loading, value, details, hint }: SummaryCardProps) {
  return (
    <Link
      to={href}
      className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-ios transition-colors hover:border-primary/40"
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h3>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-32" />
      ) : (
        <p className="mt-3 truncate font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      )}
      {details.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {details.map((d) => (
            <div key={d.label} className="min-w-0 rounded-xl bg-secondary/40 px-2.5 py-2">
              <dt className="truncate text-[11px] font-medium text-muted-foreground">{d.label}</dt>
              <dd className={`truncate text-sm font-semibold tabular-nums ${d.tone ?? 'text-foreground'}`}>{loading ? '…' : d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {hint && !loading && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
    </Link>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 px-1 font-heading text-lg font-semibold text-foreground">{children}</h2>
}

/**
 * The totals that used to sit on top of the Budgets, Bills, Goals, Money and other pages.
 * Those pages now lead with their lists; the numbers live here.
 */
export function PlansOverview() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (value: number) => formatMoney(value, currency, hideAmountsOnOpen)
  const [month] = useState(() => startOfMonth(new Date()))
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long' })
  const today = format(new Date(), 'yyyy-MM-dd')

  // Budgets and savings for this month.
  const budgetMonth = useBudgetMonth(month)
  const { data: budgetSummary, isLoading: budgetSummaryLoading } = useBudgetSummary()
  const { data: budgetPerformance, isLoading: budgetPerformanceLoading } = useBudgetPerformance()
  const budget = budgetSummary?.data

  // Money (wallets).
  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets({ limit: '100' })
  const money_ = useMemo(() => {
    const active = asList(walletsResponse?.data).filter((w) => w.status !== 'archived')
    const balance = (w: any) => Number(w.balance ?? w.currentBalance ?? 0) || 0
    const assets = active.filter((w) => w.type !== 'credit_card').reduce((s, w) => s + balance(w), 0)
    const owed = active.filter((w) => w.type === 'credit_card').reduce((s, w) => s + balance(w), 0)
    const interest = active.reduce((s, w) => s + (Number(w.totalInterestEarned) || 0), 0)
    return { count: active.length, assets, owed, interest, hasCards: active.some((w) => w.type === 'credit_card') }
  }, [walletsResponse])

  // Bills.
  const { data: billSummaryResponse, isLoading: billsLoading } = useBillSummary()
  const { data: upcomingResponse } = useUpcomingBills({ days: '7' })
  const { data: overdueResponse } = useOverdueBills()
  const bills = useMemo(() => normalizeBillSummary(billSummaryResponse), [billSummaryResponse])
  const dueSoon = useMemo(() => extractItemsCount(upcomingResponse), [upcomingResponse])
  const overdue = useMemo(() => extractItemsCount(overdueResponse), [overdueResponse])

  // Goals.
  const { data: goalsResponse, isLoading: goalsLoading } = useListGoals()
  const goals = useMemo(() => {
    const wallets = asGoalWallets(walletsResponse?.data)
    const all = (goalsResponse?.data ?? []).map((goal) => ({ goal, progress: goalProgress(goal, wallets) }))
    const open = all.filter((g) => !g.progress.reached)
    const next = open
      .filter((g) => g.goal.deadline)
      .sort((a, b) => (a.goal.deadline as string).localeCompare(b.goal.deadline as string))[0]
    return {
      count: all.length,
      open: open.length,
      reached: all.length - open.length,
      remaining: open.reduce((s, g) => s + g.progress.remaining, 0),
      perMonth: open.reduce((s, g) => s + (g.progress.monthlyNeeded ?? 0), 0),
      next,
    }
  }, [goalsResponse, walletsResponse])

  // Debts and loans.
  const { data: obligationResponse, isLoading: debtsLoading } = useObligationSummary()
  const debts = useMemo(() => {
    const s = obligationResponse?.data as any
    const owe = Number(s?.debt?.totalRemaining ?? 0)
    const owedToYou = Number(s?.lending?.totalRemaining ?? 0)
    return { owe, owedToYou, net: Number(s?.netPosition ?? owedToYou - owe), count: Number(s?.debt?.activeCount ?? 0) + Number(s?.lending?.activeCount ?? 0) }
  }, [obligationResponse])

  // Wishlist.
  const { data: wishlistData, isLoading: wishlistLoading } = useListWishlist()
  const wishlist = useMemo(() => {
    const wanted = (wishlistData ?? []).filter((i) => i.status === 'wanted')
    const monthly = wanted.reduce((s, i) => {
      if (!i.targetDate) return s
      const months = Math.max(0, differenceInCalendarDays(parseISO(i.targetDate), parseISO(today))) / DAYS_PER_MONTH
      return s + i.price / Math.max(1, months)
    }, 0)
    const needs = wanted.filter((i) => i.priority === 'need')
    return { count: wanted.length, total: wanted.reduce((s, i) => s + i.price, 0), needs: needs.reduce((s, i) => s + i.price, 0), monthly }
  }, [wishlistData, today])

  // Investments.
  const { data: investmentsResponse } = useListInvestments({ limit: '100' })
  const { data: investmentSummary, isLoading: investmentsLoading } = useInvestmentSummary()
  const investments: Investment[] = useMemo(
    () => asList(investmentsResponse?.data).map((i) => ({ ...i, id: String(i._id ?? i.id) })) as Investment[],
    [investmentsResponse]
  )
  const { holdings, liveById } = useLiveHoldings(investments)
  const invest = useMemo(() => {
    const s = investmentSummary?.data as any
    const liveDelta = holdings.reduce((sum, h) => sum + (liveById[h.id] ? liveById[h.id].value - (Number(h.currentValue) || 0) : 0), 0)
    const invested = Number(s?.totalInvested ?? 0)
    const gain = Number(s?.totalGainLoss ?? 0) + liveDelta
    return {
      count: investments.length,
      worth: Number(s?.totalCurrentValue ?? 0) + liveDelta,
      invested,
      dividends: Number(s?.totalDividends ?? 0),
      gain,
      rate: invested > 0 ? (gain / invested) * 100 : Number(s?.returnRate ?? 0),
    }
  }, [investmentSummary, holdings, liveById, investments.length])

  // Planned one-offs still ahead.
  const { data: plannedData, isLoading: plannedLoading } = useListPlannedItems()
  const planned = useMemo(() => {
    const ahead = (plannedData ?? []).filter((i) => i.date >= today)
    const sum = (type: 'income' | 'expense', key: 'amountLow' | 'amountHigh') => ahead.filter((i) => i.type === type).reduce((s, i) => s + i[key], 0)
    const income = sum('income', 'amountLow')
    const expenses = sum('expense', 'amountHigh')
    return { count: ahead.length, income, expenses, net: income - expenses }
  }, [plannedData, today])

  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${money(Math.abs(value))}`

  const cards: (SummaryCardProps & { show: boolean })[] = [
    {
      show: true,
      title: 'Money',
      href: '/wallets',
      icon: Wallet,
      tone: 'bg-primary/10 text-primary',
      loading: walletsLoading,
      value: money(money_.assets - money_.owed),
      details: [
        { label: 'Assets', value: money(money_.assets) },
        money_.hasCards ? { label: 'Owed on cards', value: money(money_.owed), tone: money_.owed > 0 ? 'text-destructive' : undefined } : { label: 'Interest earned', value: money(money_.interest) },
      ],
      hint: `Net worth across ${money_.count} wallet${money_.count === 1 ? '' : 's'}`,
    },
    {
      show: true,
      title: 'Bills & income',
      href: '/bills',
      icon: CreditCard,
      tone: 'bg-warning/15 text-warning',
      loading: billsLoading,
      value: money(bills.unpaidAmount),
      details: [
        { label: 'Due in 7 days', value: `${dueSoon}` },
        { label: 'Overdue', value: `${overdue}`, tone: overdue > 0 ? 'text-destructive' : undefined },
      ],
      hint: `Still to pay · ${bills.unpaidBills} unpaid of ${bills.totalBills}. Paid so far ${money(bills.paidAmount)}.`,
    },
    {
      show: goals.count > 0,
      title: 'Goals',
      href: '/goals',
      icon: PiggyBank,
      tone: 'bg-success/15 text-success',
      loading: goalsLoading,
      value: money(goals.remaining),
      details: [
        { label: 'Needed per month', value: money(goals.perMonth) },
        { label: 'Goals', value: `${goals.open} open${goals.reached ? ` · ${goals.reached} done` : ''}` },
      ],
      hint: goals.next?.goal.deadline
        ? `Next: ${goals.next.goal.name} by ${format(parseISO(goals.next.goal.deadline), 'MMM d')}`
        : 'Left to save across open goals',
    },
    {
      show: debts.count > 0,
      title: 'Debts & loans',
      href: '/debts',
      icon: HandCoins,
      tone: 'bg-destructive/10 text-destructive',
      loading: debtsLoading,
      value: signed(debts.net),
      details: [
        { label: 'You owe', value: money(debts.owe) },
        { label: 'Owed to you', value: money(debts.owedToYou) },
      ],
      hint: 'What you are owed minus what you owe',
    },
    {
      show: wishlist.count > 0,
      title: 'Wishlist',
      href: '/wishlist',
      icon: Gift,
      tone: 'bg-primary/10 text-primary',
      loading: wishlistLoading,
      value: money(wishlist.total),
      details: [
        { label: 'Needs', value: money(wishlist.needs) },
        { label: 'Set aside monthly', value: money(wishlist.monthly) },
      ],
      hint: `Still to buy · ${wishlist.count} item${wishlist.count === 1 ? '' : 's'}`,
    },
    {
      show: invest.count > 0,
      title: 'Investments',
      href: '/investments',
      icon: TrendingUp,
      tone: 'bg-success/15 text-success',
      loading: investmentsLoading,
      value: money(invest.worth),
      details: [
        { label: 'Put in', value: money(invest.invested) },
        { label: 'Returns received', value: money(invest.dividends) },
      ],
      hint: `${signed(invest.gain)} (${invest.rate >= 0 ? '+' : ''}${invest.rate.toFixed(1)}%) including returns`,
    },
    {
      show: planned.count > 0,
      title: 'Planned',
      href: '/planned',
      icon: CalendarClock,
      tone: 'bg-accent/15 text-accent',
      loading: plannedLoading,
      value: signed(planned.net),
      details: [
        { label: 'Coming in', value: money(planned.income) },
        { label: 'Going out', value: money(planned.expenses) },
      ],
      hint: `Planned net, worst case · ${planned.count} still ahead`,
    },
  ]

  return (
    <div className="mt-8 space-y-8">
      <section aria-label={`Budgets in ${monthLabel}`}>
        <Heading>Budgets in {monthLabel}</Heading>
        <SavingsCard
          summary={budgetMonth.summary}
          monthLabel={monthLabel}
          isPastMonth={false}
          hasSavingsWallets={budgetMonth.hasSavingsWallets}
          loading={budgetMonth.loading}
        />
        <BudgetOverview
          totalBudgeted={budget?.totalBudgeted || 0}
          totalSpent={budget?.totalSpent || 0}
          totalRemaining={budget?.totalRemaining || 0}
          activeBudgets={budget?.activeBudgets || 0}
          exceededBudgets={budget?.exceededBudgets || 0}
          currency={currency}
          burnRate={budgetPerformance?.data?.overallBurnRate || 0}
          message={budgetPerformance?.data?.message || ''}
          loading={budgetSummaryLoading || budgetPerformanceLoading}
        />
      </section>

      <section aria-label="Your money at a glance">
        <Heading>At a glance</Heading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards
            .filter((c) => c.show)
            .map((card) => (
              <SummaryCard key={card.title} {...card} />
            ))}
        </div>
      </section>
    </div>
  )
}
