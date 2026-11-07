// Milestones: moments worth marking when real money moves (a deposit toward a goal, a debt payment,
// an investment or a recorded return). Pure functions comparing a before and after state; callers
// run them only after real events, never after a balance adjustment or reconcile. Each milestone has
// a stable key, so one that was already reached (store: the milestones table) is never shown twice,
// even after a dip below the line and a recovery.

export type MilestoneKind = 'goal' | 'debt' | 'lending' | 'invest'
/** small: a quick check. medium: a short card. big: full confetti. */
export type MilestoneSize = 'small' | 'medium' | 'big'

export interface Milestone {
  kind: MilestoneKind
  /** The goal, debt or investment it is about ('portfolio' for totals across investments). */
  subjectId: string
  /** e.g. '50', 'cleared', 'installment-3', 'below-10000'. */
  level: string
  size: MilestoneSize
  title: string
  message: string
  /** A short "what changed" line, e.g. "About 4 payments left, done by March". */
  detail?: string
}

export const milestoneKey = (m: Pick<Milestone, 'kind' | 'subjectId' | 'level'>) => `${m.kind}:${m.subjectId}:${m.level}`

/** Milestones not reached before, biggest first. */
export function newMilestones(found: Milestone[], reached: Iterable<string>): Milestone[] {
  const seen = new Set(reached)
  const rank: Record<MilestoneSize, number> = { big: 0, medium: 1, small: 2 }
  const out: Milestone[] = []
  for (const m of found) {
    const key = milestoneKey(m)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out.sort((a, b) => rank[a.size] - rank[b.size])
}

type Money = (n: number) => string
const plain: Money = (n) => Math.round(n).toLocaleString('en-US')
const crossedUp = (before: number, after: number, line: number) => before < line && after >= line
const crossedDown = (before: number, after: number, line: number) => before > line && after <= line

// --- goals ---------------------------------------------------------------------------------------

export interface GoalState {
  id: string
  name: string
  target: number
}

/** Saved before and after a deposit. `dailySpend` turns the saved amount into days of spending covered. */
export function goalMilestones(goal: GoalState, before: number, after: number, opts: { money?: Money; dailySpend?: number } = {}): Milestone[] {
  const money = opts.money ?? plain
  if (goal.target <= 0 || after <= before) return []
  const out: Milestone[] = []
  const covered = opts.dailySpend && opts.dailySpend > 0 ? Math.floor(after / opts.dailySpend) : null
  const detail = covered ? `That covers about ${covered} day${covered === 1 ? '' : 's'} of your usual spending.` : undefined
  if (before <= 0 && after > 0) {
    out.push({ kind: 'goal', subjectId: goal.id, level: 'first', size: 'small', title: 'First deposit', message: `${goal.name} has started with ${money(after)}.`, detail })
  }
  for (const pct of [25, 50, 75, 100]) {
    if (!crossedUp(before, after, (goal.target * pct) / 100)) continue
    const left = Math.max(0, goal.target - after)
    out.push({
      kind: 'goal',
      subjectId: goal.id,
      level: String(pct),
      size: pct === 100 ? 'big' : pct === 50 ? 'medium' : 'small',
      title: pct === 100 ? 'Goal reached!' : pct === 50 ? 'Halfway there' : `${pct}% saved`,
      message: pct === 100 ? `You saved ${money(goal.target)} for ${goal.name}.` : `${goal.name}: ${money(after)} of ${money(goal.target)}. ${money(left)} to go.`,
      detail,
    })
  }
  return out
}

// --- debts and money lent -------------------------------------------------------------------------

export interface DebtState {
  id: string
  name: string
  direction: 'debt' | 'lending'
  principal: number
  remaining: number
  paidInstallments?: number
  totalInstallments?: number | null
  installmentAmount?: number | null
  /** Months between installments (1 monthly, 0.25 weekly, 12 yearly). */
  monthsPerInstallment?: number
  interestRate?: number | null
}

const ROUND_LINES = [1_000_000, 500_000, 250_000, 100_000, 50_000, 25_000, 10_000, 5_000, 1_000]

/** "About 4 payments left, done by Mar 2027" from the installment plan, when there is one. */
function debtFreeLine(state: DebtState, now: Date): string | undefined {
  const each = state.installmentAmount ?? 0
  if (each <= 0 || state.remaining <= 0) return undefined
  const left = Math.ceil(state.remaining / each - 1e-9)
  const months = left * (state.monthsPerInstallment ?? 1)
  const end = new Date(now.getFullYear(), now.getMonth() + Math.ceil(months), 1)
  return `About ${left} payment${left === 1 ? '' : 's'} left, done by ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}.`
}

/** A payment on a debt (or a repayment of money you lent). */
export function debtMilestones(before: DebtState, after: DebtState, opts: { money?: Money; now?: Date } = {}): Milestone[] {
  const money = opts.money ?? plain
  const now = opts.now ?? new Date()
  if (after.remaining >= before.remaining) return []
  const kind: MilestoneKind = before.direction === 'lending' ? 'lending' : 'debt'
  const out: Milestone[] = []
  const detail = debtFreeLine(after, now)
  const id = before.id

  if (after.remaining <= 0.005) {
    out.push(
      kind === 'debt'
        ? { kind, subjectId: id, level: 'cleared', size: 'big', title: 'Debt cleared!', message: `${before.name} is fully paid off.` }
        : { kind, subjectId: id, level: 'cleared', size: 'big', title: 'Paid back in full!', message: `${before.name} has been paid back.` }
    )
    return out
  }
  if (crossedDown(before.remaining, after.remaining, before.principal / 2)) {
    out.push({
      kind,
      subjectId: id,
      level: '50',
      size: 'medium',
      title: kind === 'debt' ? 'Halfway paid off' : 'Half paid back',
      message: `${before.name}: ${money(after.remaining)} left of ${money(before.principal)}.`,
      detail,
    })
  }
  if (kind === 'debt') {
    for (const line of ROUND_LINES) {
      if (line >= before.principal || !crossedDown(before.remaining, after.remaining, line - 0.005)) continue
      out.push({ kind, subjectId: id, level: `below-${line}`, size: 'small', title: `Under ${money(line)}`, message: `${before.name} is down to ${money(after.remaining)}.`, detail })
      break
    }
    const paidBefore = before.paidInstallments ?? 0
    const paidAfter = after.paidInstallments ?? paidBefore
    if (paidAfter > paidBefore) {
      const total = after.totalInstallments ? ` of ${after.totalInstallments}` : ''
      out.push({ kind, subjectId: id, level: `installment-${paidAfter}`, size: 'small', title: `Payment ${paidAfter}${total} done`, message: `${before.name}: ${money(after.remaining)} left.`, detail })
    }
  }
  return out
}

// --- investing ------------------------------------------------------------------------------------

export interface HoldingState {
  id: string
  name: string
  principal: number
  value: number
  returns: number
}

const INVESTED_LINES = [1_000_000, 500_000, 250_000, 100_000, 50_000, 10_000]

/** Holdings before and after adding an investment, updating a value or recording a return. */
export function investMilestones(before: HoldingState[], after: HoldingState[], opts: { money?: Money } = {}): Milestone[] {
  const money = opts.money ?? plain
  const out: Milestone[] = []
  if (before.length === 0 && after.length > 0) {
    out.push({ kind: 'invest', subjectId: 'portfolio', level: 'first', size: 'medium', title: 'Your first investment', message: `${after[0].name} is in. Your money has started working.` })
  }
  const returnsBefore = before.reduce((s, h) => s + h.returns, 0)
  const returnsAfter = after.reduce((s, h) => s + h.returns, 0)
  if (returnsBefore <= 0 && returnsAfter > 0) {
    out.push({ kind: 'invest', subjectId: 'portfolio', level: 'first-return', size: 'medium', title: 'Your first return', message: `${money(returnsAfter)} earned so far.` })
  }
  const was = new Map(before.map((h) => [h.id, h]))
  for (const h of after) {
    const old = was.get(h.id)
    if (!old || h.principal <= 0) continue
    if (old.value + old.returns < old.principal && h.value + h.returns >= h.principal) {
      out.push({ kind: 'invest', subjectId: h.id, level: 'above-principal', size: 'small', title: 'Back above what you put in', message: `${h.name} is worth ${money(h.value)} on ${money(h.principal)} put in.` })
    }
  }
  const putBefore = before.reduce((s, h) => s + h.principal, 0)
  const putAfter = after.reduce((s, h) => s + h.principal, 0)
  for (const line of INVESTED_LINES) {
    if (!crossedUp(putBefore, putAfter, line)) continue
    out.push({ kind: 'invest', subjectId: 'portfolio', level: `invested-${line}`, size: 'medium', title: `${money(line)} invested`, message: `You have put ${money(putAfter)} to work in total.` })
    break
  }
  return out
}
