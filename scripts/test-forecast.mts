// Run: npx tsx scripts/test-forecast.mts
import { buildForecast } from '../utils/forecast'

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++
  else {
    failures++
    console.log('FAIL', label, JSON.stringify(extra))
  }
}

const today = new Date(2026, 10, 3, 12)
const base = { startingCash: 10000, bills: [], walletTypes: {}, horizonDays: 30, today }

// No planned items: the band collapses onto the line.
const plain = buildForecast(base)
check('no plan: band is the line', plain.points.every((p) => p.low === p.balance && p.high === p.balance), plain.points[5])

// Planned items: income 5k-10k on Nov 17, expense 9k-15k on Nov 21.
const planned = [
  { id: 'b', name: 'Birthday', type: 'income' as const, date: '2026-11-17', amountLow: 5000, amountHigh: 10000 },
  { id: 'f', name: 'Flight', type: 'expense' as const, date: '2026-11-21', amountLow: 9000, amountHigh: 15000 },
]
const f = buildForecast({ ...base, planned })
const at = (d: string) => f.points.find((p) => p.date === d)!
check('before the items nothing changes', at('2026-11-16').balance === 10000 && at('2026-11-16').low === 10000, at('2026-11-16'))
check('income lands at its middle', at('2026-11-17').balance === 17500, at('2026-11-17'))
check('income band 15k to 20k', at('2026-11-17').low === 15000 && at('2026-11-17').high === 20000, at('2026-11-17'))
check('after both: middle', at('2026-11-21').balance === 5500, at('2026-11-21'))
check('after both: worst case', at('2026-11-21').low === 0, at('2026-11-21'))
check('after both: best case', at('2026-11-21').high === 11000, at('2026-11-21'))
check('planned items listed as events', f.events.some((e) => e.name === 'Flight' && e.amount === -12000 && e.range?.low === -9000), f.events)

// What-if amount for an item, kept inside its range.
const chosen = buildForecast({ ...base, planned: [{ ...planned[1], amount: 20000 }] })
check('what-if amount is capped at the high estimate', chosen.points.at(-1)!.balance === -5000, chosen.points.at(-1))
check('shortfall found from the what-if line', chosen.shortfallDate === '2026-11-21', chosen.shortfallDate)

// Daily spend slider: a typical flow of 0 income and 200 spend a day.
const slider = buildForecast({ ...base, typical: { dailyIncome: 0, dailySpend: 200 } })
check('daily spend lowers the line each day', slider.points[10].balance === 8000, slider.points[10])

// Past planned items are ignored.
const past = buildForecast({ ...base, planned: [{ ...planned[0], date: '2026-10-01' }] })
check('past item ignored', past.endBalance === 10000, past.endBalance)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
