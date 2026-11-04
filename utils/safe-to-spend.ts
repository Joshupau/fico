import { addDays, differenceInCalendarDays, endOfMonth, parseISO, startOfDay, format } from 'date-fns'
import { occurrence, type ForecastBill } from '@/utils/forecast'

/**
 * How much you can spend today without running short before the next income.
 *
 * It is a plain calculation over data the app already has, so it runs offline:
 *   usable = cash you hold now - the floor you keep back - bills due before the next income
 *   per day = (usable + what you already spent today) / days until the next income
 *   left today = per day - spent today
 */

export type SafeToSpendInput = {
  /** Total of cash-like wallets (cash, bank, e-wallet, savings you spend from). Not credit cards. */
  cashBalance: number
  /** Money to keep untouched, such as a bank's minimum balance. */
  floor?: number
  /** Unpaid bills still to pay. `amount` is what is left to pay. */
  bills: { dueDate: string; amount: number }[]
  /** Income still to come: planned items or recurring income. */
  incomes: { date: string; amount: number }[]
  /** Spent so far today, already taken out of `cashBalance`. */
  spentToday?: number
  today?: Date
  /** Used when no income is on the horizon. */
  fallbackDays?: number
}

export type SafeToSpend = {
  /** First future income date, or null when none is planned. */
  nextIncomeDate: string | null
  /** Days from today up to the day before the next income (at least 1). */
  days: number
  /** What is free to spend over those days, counting today's own spending. */
  usable: number
  billsBefore: number
  perDay: number
  leftToday: number
  /** True when `usable` is negative: the bills before payday are more than the cash. */
  short: boolean
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  const today = startOfDay(input.today ?? new Date())
  const spentToday = Math.max(0, Number(input.spentToday) || 0)
  const floor = Math.max(0, Number(input.floor) || 0)

  const future = input.incomes
    .map((i) => ({ date: startOfDay(parseISO(i.date)), amount: Number(i.amount) || 0 }))
    .filter((i) => i.amount > 0 && differenceInCalendarDays(i.date, today) > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const next = future[0]?.date ?? null
  const days = next ? Math.max(1, differenceInCalendarDays(next, today)) : Math.max(1, input.fallbackDays ?? 30)
  const horizonEnd = next ?? new Date(today.getTime() + days * 86_400_000)

  const billsBefore = input.bills
    .filter((b) => {
      const due = startOfDay(parseISO(b.dueDate))
      // Overdue bills still have to be paid, and a bill due on payday is covered by that income.
      return differenceInCalendarDays(due, horizonEnd) < 0
    })
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

  const usable = Number(input.cashBalance) - floor - billsBefore
  const pool = usable + spentToday
  const perDay = Math.max(0, pool) / days

  return {
    nextIncomeDate: next ? ymd(next) : null,
    days,
    usable,
    billsBefore,
    perDay,
    leftToday: perDay - spentToday,
    short: usable < 0,
  }
}

/**
 * The line shown right after logging something. `after` is the result computed with the new
 * transaction already counted. Returns null when there is nothing useful to say.
 */
export function instantAnswer(after: SafeToSpend, money: (n: number) => string): string | null {
  if (after.short) return `Bills before your next income are ${money(Math.abs(after.usable))} more than your cash.`
  const left = Math.round(after.leftToday)
  const until = `${money(Math.round(after.usable))} until ${after.nextIncomeDate ? 'payday' : 'month end'}.`
  if (left >= 0) return `${money(left)} left for today, ${until}`
  return `${money(-left)} over today's pace. ${until.charAt(0).toUpperCase()}${until.slice(1)}`
}

/** A transaction's effect on the inputs, so the answer can be worked out before the data refetches. */
export function applyTransaction(
  input: SafeToSpendInput,
  txn: {
    type: 'income' | 'expense' | 'transfer'
    amount: number
    fromCash: boolean
    toCash?: boolean
    affectsBalance?: boolean
    /** The wallet is left out of safe to spend (turned off, or savings), so its spending doesn't count. */
    fromExcluded?: boolean
  }
): SafeToSpendInput {
  if (txn.affectsBalance === false) return input
  const amount = Number(txn.amount) || 0
  if (txn.type === 'expense') {
    if (txn.fromExcluded) return input
    // Card spending counts too: the card bill will be paid out of cash, so it uses up today's allowance.
    return { ...input, cashBalance: input.cashBalance - amount, spentToday: (input.spentToday ?? 0) + amount }
  }
  if (txn.type === 'income') {
    return { ...input, cashBalance: txn.fromCash ? input.cashBalance + amount : input.cashBalance }
  }
  // A transfer only changes the cash total when it crosses between cash and a card or loan.
  const delta = (txn.toCash ? amount : 0) - (txn.fromCash ? amount : 0)
  return { ...input, cashBalance: input.cashBalance + delta }
}

/** Wallet types whose money you spend day to day. Savings and credit cards are left out, as in the MCP `safe_to_spend` tool. */
export const isCashWallet = (type?: string) => type !== 'savings' && type !== 'credit_card'

/** Per-wallet choices for the safe-to-spend total, keyed by wallet id. */
export type SafeWalletRule = { include?: boolean; min?: number }

/** Whether a wallet counts: your choice when you made one, otherwise cash, bank and e-wallets do. */
export const walletCounts = (wallet: { type?: string }, rule?: SafeWalletRule) =>
  wallet.type !== 'credit_card' && (rule?.include ?? isCashWallet(wallet.type))

/**
 * Builds the inputs from what the app already loads: active wallets, open bills (expense and income,
 * recurring ones expanded), planned expenses and today's spending. Each counted wallet gives what is
 * above its minimum (a bank's maintaining balance, say). With no income on the Bills page it counts
 * to the end of the month, the same fallback the MCP tool uses.
 */
export function safeToSpendInputs(data: {
  wallets: { id?: string; _id?: string; type?: string; balance?: number | string; status?: string }[]
  openBills: ForecastBill[]
  /** Planned one-off items. Expenses count at their high estimate; planned income is not counted. */
  planned?: { type: 'income' | 'expense'; date: string; amountHigh: number; amountLow?: number }[]
  rules?: Record<string, SafeWalletRule>
  spentToday?: number
  /** Today's spending per wallet id. When given, spending from wallets left out of the total is dropped. */
  spentByWallet?: Record<string, number>
  floor?: number
  today?: Date
}): SafeToSpendInput {
  const today = startOfDay(data.today ?? new Date())
  const horizon = addDays(today, 62)
  const cashBalance = data.wallets
    .filter((w) => w.status !== 'archived')
    .reduce((sum, w) => {
      const rule = data.rules?.[String(w.id ?? w._id ?? '')]
      if (!walletCounts(w, rule)) return sum
      return sum + Math.max(0, (Number(w.balance) || 0) - Math.max(0, Number(rule?.min) || 0))
    }, 0)

  let spentToday = data.spentToday
  if (data.spentByWallet) {
    const byId = new Map(data.wallets.map((w) => [String(w.id ?? w._id ?? ''), w]))
    spentToday = Object.entries(data.spentByWallet).reduce((sum, [id, amount]) => {
      const wallet = byId.get(id)
      // Card spending still counts (the card bill is paid from cash), and so does a wallet that is
      // no longer listed. A wallet you turned off, or savings, is not spending money.
      const counts = !wallet || wallet.type === 'credit_card' || walletCounts(wallet, data.rules?.[id])
      return counts ? sum + (Number(amount) || 0) : sum
    }, 0)
  }

  const bills: SafeToSpendInput['bills'] = []
  const incomes: SafeToSpendInput['incomes'] = []
  for (const bill of data.openBills) {
    const due = startOfDay(parseISO(String(bill.dueDate)))
    const add = (date: Date, amount: number) => {
      if (amount <= 0) return
      if (bill.type === 'income') incomes.push({ date: ymd(date), amount })
      else bills.push({ dueDate: ymd(date), amount })
    }
    add(due, Math.max(0, (Number(bill.amount) || 0) - (Number(bill.paidAmount) || 0)))
    if (!bill.isRecurring || !bill.recurringFrequency) continue
    for (let n = 1, next = occurrence(due, bill.recurringFrequency, 1); next <= horizon && n < 400; next = occurrence(due, bill.recurringFrequency, ++n)) {
      // Later occurrences that already passed were paid or skipped; only the open one is still owed.
      if (next < today) continue
      add(next, Number(bill.amount) || 0)
    }
  }
  for (const item of data.planned ?? []) {
    if (item.type !== 'expense') continue
    const date = startOfDay(parseISO(String(item.date)))
    if (date < today) continue
    const amount = Number(item.amountHigh) || Number(item.amountLow) || 0
    if (amount > 0) bills.push({ dueDate: ymd(date), amount })
  }

  return {
    cashBalance,
    floor: data.floor,
    bills,
    incomes,
    spentToday,
    today,
    fallbackDays: Math.max(1, differenceInCalendarDays(endOfMonth(today), today)),
  }
}
