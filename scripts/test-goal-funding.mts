// Goal auto-funding on payday. Run: npx tsx scripts/test-goal-funding.mts
import { paydayContributions, type FundableGoal } from '../utils/goal-funding'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

const goals: FundableGoal[] = [
  { id: 'e', name: 'Emergency fund', target: 50_000, saved: 10_000, funding: { kind: 'percent', value: 10 }, linkedWalletIds: ['savings'] },
  { id: 't', name: 'Japan trip', target: 60_000, saved: 58_500, funding: { kind: 'fixed', value: 3_000 }, linkedWalletIds: ['trip'] },
  { id: 'n', name: 'No funding', target: 1_000, saved: 0, funding: null, linkedWalletIds: ['x'] },
  { id: 'w', name: 'No wallet', target: 1_000, saved: 0, funding: { kind: 'fixed', value: 500 }, linkedWalletIds: [] },
]

// ₱25,000 pay: 10% = 2,500 to the emergency fund; the trip only needs 1,500 more.
const c = paydayContributions(25_000, goals, 'payroll')
check('percent and capped fixed', c.map((x) => `${x.goalId}:${x.amount}:${x.toWalletId}`).join() === 'e:2500:savings,t:1500:trip', c)
check('rounds percent to 10', paydayContributions(12_345, goals.slice(0, 1))[0].amount === 1_230)
check('never more than the pay', paydayContributions(1_000, [{ ...goals[1], saved: 0, funding: { kind: 'fixed', value: 3_000 } }])[0].amount === 1_000)
check('reached goals take nothing', paydayContributions(25_000, [{ ...goals[0], saved: 50_000 }]).length === 0)
check('never back into the pay wallet', paydayContributions(25_000, [{ ...goals[0], linkedWalletIds: ['payroll'] }], 'payroll').length === 0)
check('second linked wallet is used if the first is the pay wallet', paydayContributions(25_000, [{ ...goals[0], linkedWalletIds: ['payroll', 'mp2'] }], 'payroll')[0].toWalletId === 'mp2')

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
