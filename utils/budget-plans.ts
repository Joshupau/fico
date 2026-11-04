// Budget plans and "how much you can save", worked out from data the app already loads.
//
//   income this month = income received so far (lending and repayments left out)
//                       + income still due this month on the Bills page
//   can save          = income - what your budgets let you spend (or what you already spent, if more)
//   saved so far      = money that moved into savings wallets this month, minus what left them
//
// A plan splits an income into groups. A spending group's budgets count against its target; a
// savings group counts the money moved into its wallets (every savings wallet when none are picked).
import type { BudgetPlan, BudgetPlanGroup } from '@/types/budget-plan'

export type PlanBudget = {
  id: string
  name: string
  amount: number
  spent: number
  period: string
  categoryIds: string[]
  groupId: string | null
  startDate?: string | null
  endDate?: string | null
}

export type MonthTxn = {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  walletId: string
  toWalletId?: string | null
  obligationId?: string | null
}

const daysInMonth = (month: Date) => new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

/** A budget's limit for one calendar month: yearly is a twelfth, weekly and daily scale to the month. */
export function monthlyLimit(budget: Pick<PlanBudget, 'amount' | 'period'>, month: Date): number {
  const amount = Number(budget.amount) || 0
  switch (budget.period) {
    case 'yearly':
      return amount / 12
    case 'weekly':
      return (amount * daysInMonth(month)) / 7
    case 'daily':
      return amount * daysInMonth(month)
    default:
      return amount
  }
}

export type MonthBudgetLine = {
  /** The latest row of the budget (each period is its own row). */
  id: string
  /** Every row of this budget inside the month. */
  rowIds: string[]
  name: string
  categoryIds: string[]
  period: string
  groupId: string | null
  limit: number
  spent: number
}

/**
 * One line per budget for the month. Weekly and daily budgets have a row for every period, so rows
 * that are the same budget (same period, categories and group) are merged: the limit comes from the
 * latest row, the spending is added up. Yearly budgets use what was spent inside the month when known.
 */
export function monthBudgetLines(budgets: PlanBudget[], month: Date, yearlyMonthSpent?: Record<string, number>): MonthBudgetLine[] {
  const byKey = new Map<string, { latest: PlanBudget; spent: number; rowIds: string[] }>()
  for (const b of budgets) {
    const short = b.period === 'weekly' || b.period === 'daily'
    const key = short ? `${b.period}|${[...b.categoryIds].sort().join(',')}|${b.groupId ?? ''}|${b.name.replace(/ \(Rolled Over\)$/, '')}` : b.id
    const spent = b.period === 'yearly' && yearlyMonthSpent?.[b.id] !== undefined ? Number(yearlyMonthSpent[b.id]) || 0 : Number(b.spent) || 0
    const entry = byKey.get(key)
    if (!entry) byKey.set(key, { latest: b, spent, rowIds: [b.id] })
    else {
      entry.spent += spent
      entry.rowIds.push(b.id)
      if (String(b.startDate ?? '') > String(entry.latest.startDate ?? '')) entry.latest = b
    }
  }
  return [...byKey.values()].map(({ latest, spent, rowIds }) => ({
    id: latest.id,
    rowIds,
    name: latest.name,
    categoryIds: latest.categoryIds,
    period: latest.period,
    groupId: latest.groupId,
    limit: monthlyLimit(latest, month),
    spent,
  }))
}

/** What a set of budgets takes out of the month: each one's limit, or its spending when over. */
export const committed = (lines: MonthBudgetLine[]) => lines.reduce((sum, l) => sum + Math.max(l.limit, l.spent), 0)

/** Income received in the month. Lending and repayments (linked to a debt or loan) are not income. */
export function receivedIncome(txns: MonthTxn[]): number {
  return txns.reduce((sum, t) => (t.type === 'income' && !t.obligationId ? sum + (Number(t.amount) || 0) : sum), 0)
}

/**
 * Net money into a set of savings wallets: transfers in, minus transfers out, plus income paid
 * straight into them (interest, a salary split), minus spending from them.
 */
export function savedInto(txns: MonthTxn[], walletIds: Set<string>): number {
  let saved = 0
  for (const t of txns) {
    const amount = Number(t.amount) || 0
    const from = walletIds.has(t.walletId)
    const to = !!t.toWalletId && walletIds.has(t.toWalletId)
    if (t.type === 'transfer') {
      if (to && !from) saved += amount
      else if (from && !to) saved -= amount
    } else if (t.type === 'income' && from) saved += amount
    else if (t.type === 'expense' && from) saved -= amount
  }
  return saved
}

export type SavingsSummary = {
  received: number
  stillDue: number
  income: number
  budgeted: number
  spent: number
  /** income - budgeted (with overspending): what is left if you stay within your budgets. */
  canSave: number
  savedSoFar: number
}

export function savingsSummary(input: {
  lines: MonthBudgetLine[]
  txns: MonthTxn[]
  incomeStillDue: number
  savingsWalletIds: Set<string>
}): SavingsSummary {
  const received = receivedIncome(input.txns)
  const income = received + Math.max(0, input.incomeStillDue)
  const budgeted = committed(input.lines)
  return {
    received,
    stillDue: Math.max(0, input.incomeStillDue),
    income,
    budgeted,
    spent: input.lines.reduce((s, l) => s + l.spent, 0),
    canSave: income - budgeted,
    savedSoFar: savedInto(input.txns, input.savingsWalletIds),
  }
}

export type GroupStatus = {
  group: BudgetPlanGroup
  target: number
  /** Spending groups: the group's budgets. */
  lines: MonthBudgetLine[]
  budgeted: number
  /** Spending groups: spent. Savings groups: saved this month. */
  progress: number
  pct: number
}

export type PlanStatus = {
  plan: BudgetPlan
  income: number
  /** True when the plan has no income of its own and uses the month's income. */
  usesMonthIncome: boolean
  groups: GroupStatus[]
  spendTarget: number
  spent: number
  saveTarget: number
  saved: number
  /** Left of the plan's income if every spending group stays within its limit. */
  canSave: number
  /** Percent of the income the groups' targets add up to. */
  allocatedPct: number
}

export const groupTarget = (group: Pick<BudgetPlanGroup, 'percent' | 'amount'>, income: number) =>
  group.percent !== null && group.percent !== undefined ? (income * Number(group.percent)) / 100 : Number(group.amount) || 0

export function planStatus(input: {
  plan: BudgetPlan
  lines: MonthBudgetLine[]
  txns: MonthTxn[]
  monthIncome: number
  savingsWalletIds: Set<string>
}): PlanStatus {
  const { plan } = input
  const usesMonthIncome = plan.income === null || plan.income === undefined
  const income = usesMonthIncome ? input.monthIncome : Number(plan.income) || 0
  const groups = [...plan.groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => {
      const target = groupTarget(group, income)
      const lines = input.lines.filter((l) => l.groupId === group.id)
      const budgeted = lines.reduce((s, l) => s + l.limit, 0)
      const wallets = group.walletIds.length ? new Set(group.walletIds) : input.savingsWalletIds
      const progress = group.kind === 'save' ? savedInto(input.txns, wallets) : lines.reduce((s, l) => s + l.spent, 0)
      return { group, target, lines, budgeted, progress, pct: target > 0 ? (Math.max(0, progress) / target) * 100 : 0 }
    })
  const spendGroups = groups.filter((g) => g.group.kind === 'spend')
  const saveGroups = groups.filter((g) => g.group.kind === 'save')
  // A spending group's limit is its budgets when it has any, otherwise its target.
  const spendLimit = spendGroups.reduce((s, g) => s + Math.max(g.lines.length ? committed(g.lines) : g.target, g.progress), 0)
  return {
    plan,
    income,
    usesMonthIncome,
    groups,
    spendTarget: spendGroups.reduce((s, g) => s + g.target, 0),
    spent: spendGroups.reduce((s, g) => s + g.progress, 0),
    saveTarget: saveGroups.reduce((s, g) => s + g.target, 0),
    saved: saveGroups.reduce((s, g) => s + g.progress, 0),
    canSave: income - spendLimit,
    allocatedPct: income > 0 ? (groups.reduce((s, g) => s + g.target, 0) / income) * 100 : 0,
  }
}

export type PlanTemplate = {
  key: string
  label: string
  description: string
  groups: { name: string; kind: 'spend' | 'save'; percent: number; icon: string; color: string }[]
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    key: '50-30-20',
    label: '50/30/20',
    description: 'Half on needs, 30% on wants, 20% saved.',
    groups: [
      { name: 'Needs', kind: 'spend', percent: 50, icon: 'heart', color: '#0A84FF' },
      { name: 'Wants', kind: 'spend', percent: 30, icon: 'sparkles', color: '#AF52DE' },
      { name: 'Savings', kind: 'save', percent: 20, icon: 'piggy', color: '#34C759' },
    ],
  },
  {
    key: '70-20-10',
    label: '70/20/10',
    description: '70% to live on, 20% saved, 10% to debts or giving.',
    groups: [
      { name: 'Living', kind: 'spend', percent: 70, icon: 'home', color: '#0A84FF' },
      { name: 'Savings', kind: 'save', percent: 20, icon: 'piggy', color: '#34C759' },
      { name: 'Debts & giving', kind: 'spend', percent: 10, icon: 'hand', color: '#FF9500' },
    ],
  },
  {
    key: 'custom',
    label: 'Start empty',
    description: 'Make your own groups.',
    groups: [],
  },
]
