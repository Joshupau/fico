// When a goal is reached at a steady monthly saving, and how much sooner a little more gets there.
// Used by onboarding's first question. Tested in scripts/test-goal-forecast.mts.

import { addMonths } from 'date-fns'

export interface GoalForecast {
  months: number
  date: Date
  /** Saving `extra` more a month reaches it `months` months sooner, by `date`. Null when it wouldn't help. */
  sooner: { extra: number; months: number; date: Date } | null
}

const monthsFor = (left: number, monthly: number) => Math.max(1, Math.ceil(left / monthly))

/** A round "a bit more" to suggest: about a fifth of what you save, in steps of 100, 500 or 1,000. */
export function nudgeAmount(monthly: number): number {
  const raw = monthly * 0.2
  const step = raw >= 2_000 ? 1_000 : raw >= 500 ? 500 : 100
  return Math.max(step, Math.round(raw / step) * step)
}

export function goalForecast(input: { target: number; saved?: number; monthly: number; today?: Date }): GoalForecast | null {
  const left = input.target - (input.saved ?? 0)
  if (!(input.monthly > 0) || !(input.target > 0)) return null
  const today = input.today ?? new Date()
  if (left <= 0) return { months: 0, date: today, sooner: null }
  const months = monthsFor(left, input.monthly)
  const extra = nudgeAmount(input.monthly)
  const faster = monthsFor(left, input.monthly + extra)
  return {
    months,
    date: addMonths(today, months),
    sooner: faster < months ? { extra, months: months - faster, date: addMonths(today, faster) } : null,
  }
}
