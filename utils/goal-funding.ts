// Goal auto-funding on payday (E6): each goal can take a share of the pay or a fixed amount, moved
// into the goal's first linked wallet with one tap on the payday card. Tested in scripts/test-goal-funding.mts.

export type GoalFunding = { kind: 'percent' | 'fixed'; value: number }

export interface FundableGoal {
  id: string
  name: string
  target: number
  /** Saved so far. */
  saved: number
  funding?: GoalFunding | null
  linkedWalletIds: string[]
}

export interface Contribution {
  goalId: string
  goalName: string
  toWalletId: string
  amount: number
}

const roundTo10 = (n: number) => Math.round(n / 10) * 10

/**
 * What each auto-funded goal takes from this pay, in goal order. A goal never takes more than it still
 * needs, the money never goes back into the wallet it came from, and the total never exceeds the pay.
 */
export function paydayContributions(pay: number, goals: FundableGoal[], fromWalletId?: string | null): Contribution[] {
  const out: Contribution[] = []
  let left = Math.max(0, pay)
  for (const g of goals) {
    const f = g.funding
    const to = g.linkedWalletIds.find((id) => id !== fromWalletId)
    if (!f || !(f.value > 0) || !to || left <= 0) continue
    const wanted = f.kind === 'percent' ? roundTo10((pay * Math.min(100, f.value)) / 100) : f.value
    const amount = Math.min(wanted, Math.max(0, g.target - g.saved), left)
    if (amount <= 0) continue
    out.push({ goalId: g.id, goalName: g.name, toWalletId: to, amount })
    left -= amount
  }
  return out
}

export const fundingLabel = (f: GoalFunding | null | undefined, money: (n: number) => string) =>
  !f || !(f.value > 0) ? null : f.kind === 'percent' ? `${f.value}% of each pay` : `${money(f.value)} each payday`
