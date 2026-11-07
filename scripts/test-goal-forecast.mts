// Onboarding goal forecast. Run: npx tsx scripts/test-goal-forecast.mts
import { goalForecast, nudgeAmount } from '../utils/goal-forecast'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const today = new Date(2026, 10, 7)

// ₱50,000 at ₱5,000 a month: 10 months, Sep 2027. +₱1,000 a month: 9 months (8.33 → 9), 1 sooner.
const f = goalForecast({ target: 50_000, monthly: 5_000, today })!
check('months and date', f.months === 10 && f.date.getFullYear() === 2027 && f.date.getMonth() === 8, f)
check('a bit more is sooner', f.sooner?.extra === 1_000 && f.sooner.months === 1, f.sooner)
// Some already saved.
check('counts what is saved', goalForecast({ target: 50_000, saved: 20_000, monthly: 5_000, today })!.months === 6)
check('already there', goalForecast({ target: 1_000, saved: 1_000, monthly: 500, today })!.months === 0)
check('no saving, no forecast', goalForecast({ target: 1_000, monthly: 0, today }) === null)
check('less than a month rounds up to 1', goalForecast({ target: 300, monthly: 5_000, today })!.months === 1)
check('nudge amounts', nudgeAmount(1_000) === 200 && nudgeAmount(3_000) === 500 && nudgeAmount(20_000) === 4_000, [nudgeAmount(1_000), nudgeAmount(3_000), nudgeAmount(20_000)])

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
