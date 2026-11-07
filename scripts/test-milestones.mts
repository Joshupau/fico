// Milestone rules. Run: npx tsx scripts/test-milestones.mts
import { debtMilestones, goalMilestones, investMilestones, milestoneKey, newMilestones, type DebtState } from '../utils/milestones'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const levels = (list: { level: string }[]) => list.map((m) => m.level).join()

// Goals.
const goal = { id: 'g', name: 'Manila fund', target: 10_000 }
check('first deposit', levels(goalMilestones(goal, 0, 500)) === 'first')
check('25% crossed', levels(goalMilestones(goal, 2_000, 2_600)) === '25')
check('one deposit can cross several lines', levels(goalMilestones(goal, 1_000, 8_000)) === '25,50,75')
check('100% is big', goalMilestones(goal, 9_000, 10_000).find((m) => m.level === '100')?.size === 'big')
check('a withdrawal crosses nothing', goalMilestones(goal, 6_000, 4_000).length === 0)
check('days of spending covered', /50 days/.test(goalMilestones(goal, 0, 5_000, { dailySpend: 100 })[0].detail ?? ''))

// A dip below a line and back up: the pure rule sees the crossing again, the reached list filters it.
const reached = new Set<string>()
const first = newMilestones(goalMilestones(goal, 4_000, 5_500), reached)
first.forEach((m) => reached.add(milestoneKey(m)))
const dip = goalMilestones(goal, 5_500, 4_000)
const again = newMilestones(goalMilestones(goal, 4_000, 5_600), reached)
check('dip and recovery: no repeat', levels(first) === '50' && dip.length === 0 && again.length === 0, { first, again })
check('biggest first', newMilestones(goalMilestones(goal, 0, 10_000), [])[0].level === '100')

// Debts.
const loan: DebtState = { id: 'd', name: 'Phone loan', direction: 'debt', principal: 24_000, remaining: 13_000, paidInstallments: 5, totalInstallments: 12, installmentAmount: 2_000, monthsPerInstallment: 1 }
const paid = debtMilestones(loan, { ...loan, remaining: 11_000, paidInstallments: 6 }, { now: new Date(2026, 10, 7) })
check('halfway at 50%', paid.some((m) => m.level === '50'), levels(paid))
check('each installment', paid.some((m) => m.level === 'installment-6' && /6 of 12/.test(m.title)), levels(paid))
check('debt-free date', /About 6 payments left, done by May 2027/.test(paid[0].detail ?? ''), paid[0].detail)
const under = debtMilestones({ ...loan, remaining: 10_400 }, { ...loan, remaining: 9_800, paidInstallments: 5 })
check('below a round number', under.some((m) => m.level === 'below-10000'), levels(under))
check('cleared is big and alone', levels(debtMilestones(loan, { ...loan, remaining: 0 })) === 'cleared' && debtMilestones(loan, { ...loan, remaining: 0 })[0].size === 'big')
const lent: DebtState = { id: 'l', name: 'Lent to Ana', direction: 'lending', principal: 2_000, remaining: 1_500 }
check('money lent paid back', debtMilestones(lent, { ...lent, remaining: 0 })[0].kind === 'lending' && debtMilestones(lent, { ...lent, remaining: 0 })[0].level === 'cleared')
check('a balance going up is not a milestone', debtMilestones(loan, { ...loan, remaining: 14_000 }).length === 0)

// Investing.
const fund = { id: 'i', name: 'Index fund', principal: 9_000, value: 8_500, returns: 0 }
check('first investment', levels(investMilestones([], [fund])) === 'first')
check('first return', investMilestones([fund], [{ ...fund, returns: 50 }]).some((m) => m.level === 'first-return'))
check('value back above principal', investMilestones([fund], [{ ...fund, value: 9_100 }]).some((m) => m.level === 'above-principal'))
check('total invested crosses a round amount', investMilestones([fund], [fund, { id: 'j', name: 'Bonds', principal: 2_000, value: 2_000, returns: 0 }]).some((m) => m.level === 'invested-10000'))

console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
