// Small reasons to open the app: the payday card, a friendly utang reminder and a weekly recap.
// Pure helpers, so the wording and the sums are tested in scripts/test-retention.mts.

import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

// ---------- Payday ----------

const SALARY_WORDS = /\b(sahod|sweldo|suweldo|salary|salaries|payroll|wage|wages|pay\s?check|paycheque|kinsenas|katapusan|13th month|bonus)\b/i

export interface IncomeToday {
  amount: number
  description?: string | null
  /** Set when the income came from marking an income bill received. */
  billId?: string | null
}

/**
 * Today's pay, if any: income from an income bill (how payday is set up in Fico), or income whose
 * note reads like salary. Lending repayments and transfers never count.
 */
export function paydayToday(incomes: IncomeToday[]): { amount: number; count: number } | null {
  const pay = incomes.filter((i) => Number(i.amount) > 0 && (!!i.billId || SALARY_WORDS.test(i.description ?? '')))
  if (!pay.length) return null
  return { amount: pay.reduce((s, i) => s + Number(i.amount), 0), count: pay.length }
}

// ---------- Utang reminder ----------

export type ReminderTone = 'gentle' | 'direct'

export const REMINDER_TONES: { value: ReminderTone; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'direct', label: 'Direct' },
]

export interface UtangReminderInput {
  counterparty: string
  /** What the money was for, e.g. "Concert tickets". */
  name?: string | null
  remaining: number
  dueDate?: string | null
  money: (value: number) => string
  today?: Date
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** A short message to send someone who owes you. Polite Taglish, the way people actually text. */
export function utangMessage(input: UtangReminderInput, tone: ReminderTone): string {
  const who = firstName(input.counterparty)
  const amount = input.money(input.remaining)
  const forWhat = input.name && input.name.trim().toLowerCase() !== input.counterparty.trim().toLowerCase() ? ` for ${input.name.trim()}` : ''
  const today = startOfDay(input.today ?? new Date())
  const due = input.dueDate ? startOfDay(parseISO(input.dueDate)) : null
  const days = due ? differenceInCalendarDays(due, today) : null
  const when =
    days === null
      ? ''
      : days < 0
        ? ` It was due last ${format(due!, 'MMM d')}.`
        : days === 0
          ? ' It’s due today.'
          : days === 1
            ? ' It’s due tomorrow.'
            : ` It’s due on ${format(due!, 'MMM d')}.`

  if (tone === 'direct') {
    return `Hi ${who}, reminder lang about the ${amount}${forWhat}.${when} Can you send it${days !== null && days < 0 ? ' this week' : ' on time'}? Thanks!`
  }
  return `Hi ${who}! Hope you’re doing well. Gentle reminder lang po about the ${amount}${forWhat}.${when} No rush, just let me know when you can send it. Salamat!`
}

// ---------- Weekly recap ----------

export interface RecapSpend {
  date: string
  amount: number
  category?: string | null
}

export interface WeeklyRecap {
  weekStart: Date
  weekEnd: Date
  total: number
  previous: number
  /** Change against the week before, as a share (0.12 = 12% more). Null when there is nothing to compare. */
  change: number | null
  topCategory: { name: string; amount: number; share: number } | null
  biggestDay: { date: Date; amount: number } | null
  noSpendDays: number
}

/** The week starting `weekStart` (a Monday) against the week before it. */
export function weeklyRecap(spends: RecapSpend[], weekStart: Date): WeeklyRecap {
  const start = startOfDay(weekStart)
  const end = addDays(start, 7)
  const prevStart = addDays(start, -7)
  const at = (s: RecapSpend) => new Date(s.date)
  const week = spends.filter((s) => at(s) >= start && at(s) < end)
  const prev = spends.filter((s) => at(s) >= prevStart && at(s) < start)
  const total = week.reduce((s, x) => s + x.amount, 0)
  const previous = prev.reduce((s, x) => s + x.amount, 0)

  const byCat = new Map<string, number>()
  const byDay = new Map<string, number>()
  for (const s of week) {
    const cat = s.category || 'Other'
    byCat.set(cat, (byCat.get(cat) ?? 0) + s.amount)
    const day = format(at(s), 'yyyy-MM-dd')
    byDay.set(day, (byDay.get(day) ?? 0) + s.amount)
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
  const big = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    weekStart: start,
    weekEnd: addDays(start, 6),
    total,
    previous,
    change: previous > 0 ? (total - previous) / previous : null,
    topCategory: top ? { name: top[0], amount: top[1], share: total > 0 ? top[1] / total : 0 } : null,
    biggestDay: big ? { date: parseISO(big[0]), amount: big[1] } : null,
    noSpendDays: 7 - [...byDay.values()].filter((v) => v > 0).length,
  }
}

/**
 * The recap as text to share. With `amounts` off it only gives shares and counts, so it can be posted
 * without showing how much you spend.
 */
export function recapText(r: WeeklyRecap, money: (value: number) => string, amounts: boolean): string {
  const range = `${format(r.weekStart, 'MMM d')} to ${format(r.weekEnd, 'MMM d')}`
  const lines = [`My week in Fico (${range})`]
  if (r.total <= 0) {
    lines.push('No spending at all this week. 🎉')
    return lines.join('\n')
  }
  if (amounts) lines.push(`Spent ${money(r.total)}`)
  if (r.change !== null && Math.abs(r.change) >= 0.01) {
    const pct = Math.round(Math.abs(r.change) * 100)
    lines.push(r.change < 0 ? `📉 ${pct}% less than the week before` : `📈 ${pct}% more than the week before`)
  }
  if (r.topCategory) {
    lines.push(`Most went to ${r.topCategory.name} (${Math.round(r.topCategory.share * 100)}%${amounts ? `, ${money(r.topCategory.amount)}` : ''})`)
  }
  if (r.noSpendDays > 0) lines.push(`${r.noSpendDays} no-spend day${r.noSpendDays === 1 ? '' : 's'} 💪`)
  return lines.join('\n')
}

/** Shares text with the phone's share sheet, or copies it. Returns what happened. */
export async function shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, title })
      return 'shared'
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
