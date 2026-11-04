import { useMemo } from 'react'
import { useBudgetsMonthSpent, useListBudgets } from '@/queries/user/budget/budgets'
import { useListPlans, useMonthTransactions } from '@/queries/user/budget-plan/budget-plans'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useOpenBills } from '@/queries/user/forecast/forecast'
import { budgetOverlapsMonth, isSameMonth, startOfMonth } from '@/utils/budget-month'
import { safeToSpendInputs } from '@/utils/safe-to-spend'
import { monthBudgetLines, planStatus, savingsSummary, type PlanBudget } from '@/utils/budget-plans'

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.budgets) ? data.budgets : [])

/** Income bills (Bills page) still to come inside the month. Past months have none. */
function incomeDueInMonth(openBills: any[] | undefined, month: Date): number {
  if (!openBills?.length) return 0
  const today = new Date()
  const monthStart = startOfMonth(month)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  if (monthEnd <= startOfMonth(today)) return 0
  const { incomes } = safeToSpendInputs({ wallets: [], openBills, today: isSameMonth(month, today) ? today : monthStart })
  return incomes
    .filter((i) => {
      const d = new Date(`${i.date}T00:00:00`)
      return d >= monthStart && d < monthEnd
    })
    .reduce((s, i) => s + i.amount, 0)
}

/**
 * Everything the savings card and the plans need for one month: the month's budgets, income,
 * savings and each plan's totals.
 */
export function useBudgetMonth(month: Date) {
  const { data: listResponse, isLoading: budgetsLoading } = useListBudgets({ page: '0', limit: '100' })
  const { data: plans, isLoading: plansLoading, isError: plansError } = useListPlans()
  const { data: txns, isLoading: txnsLoading } = useMonthTransactions(month)
  const { data: walletsResponse } = useListWallets({ limit: '100' })
  const { data: openBills } = useOpenBills()

  const rows = useMemo(() => asList(listResponse?.data), [listResponse])
  const budgets: PlanBudget[] = useMemo(
    () =>
      rows
        .filter((b) => budgetOverlapsMonth(b, month))
        .map((b) => ({
          id: String(b._id ?? b.id),
          name: b.name || 'Untitled Budget',
          amount: Number(b.amount) || 0,
          spent: Number(b.spent) || 0,
          period: b.period || 'monthly',
          categoryIds: b.categoryIds ?? [],
          groupId: b.groupId ?? null,
          startDate: b.startDate,
          endDate: b.endDate,
        })),
    [rows, month]
  )
  const hasYearly = budgets.some((b) => b.period === 'yearly')
  const { data: yearlyMonthSpent } = useBudgetsMonthSpent(month, hasYearly)
  const lines = useMemo(() => monthBudgetLines(budgets, month, yearlyMonthSpent), [budgets, month, yearlyMonthSpent])

  const wallets = useMemo(() => asList(walletsResponse?.data), [walletsResponse])
  const savingsWalletIds = useMemo(
    () => new Set(wallets.filter((w) => w.type === 'savings').map((w) => String(w._id ?? w.id))),
    [wallets]
  )
  const savingsWallets = useMemo(
    () => wallets.filter((w) => w.status !== 'archived' && w.type !== 'credit_card').map((w) => ({ id: String(w._id ?? w.id), name: String(w.name), type: String(w.type) })),
    [wallets]
  )
  const incomeStillDue = useMemo(() => incomeDueInMonth(openBills as any[] | undefined, month), [openBills, month])

  const summary = useMemo(
    () => savingsSummary({ lines, txns: txns ?? [], incomeStillDue, savingsWalletIds }),
    [lines, txns, incomeStillDue, savingsWalletIds]
  )

  const planStatuses = useMemo(
    () => (plans ?? []).map((plan) => planStatus({ plan, lines, txns: txns ?? [], monthIncome: summary.income, savingsWalletIds })),
    [plans, lines, txns, summary.income, savingsWalletIds]
  )

  const groupIds = useMemo(() => new Set((plans ?? []).flatMap((p) => p.groups.map((g) => g.id))), [plans])
  const everydayLines = useMemo(() => lines.filter((l) => !l.groupId || !groupIds.has(l.groupId)), [lines, groupIds])

  return {
    budgets,
    lines,
    everydayLines,
    summary,
    plans: plans ?? [],
    planStatuses,
    plansUnavailable: plansError,
    savingsWallets,
    hasSavingsWallets: savingsWalletIds.size > 0,
    loading: budgetsLoading || txnsLoading,
    plansLoading,
  }
}
