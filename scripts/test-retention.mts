// Payday, utang reminder and weekly recap helpers. Run: npx tsx scripts/test-retention.mts
import { paydayToday, recapText, utangMessage, weeklyRecap } from '../utils/retention'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const money = (n: number) => '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Payday.
check('income bill counts as pay', paydayToday([{ amount: 25_000, billId: 'b1' }])?.amount === 25_000)
check('salary words count', paydayToday([{ amount: 12_500, description: 'Sahod kinsenas' }, { amount: 300, description: 'GCash from Ana' }])?.amount === 12_500)
check('random income is not payday', paydayToday([{ amount: 500, description: 'Sold old phone case' }]) === null)
check('nothing today', paydayToday([]) === null)

// Utang reminder.
const today = new Date(2026, 10, 7)
const gentle = utangMessage({ counterparty: 'Ana Santos', name: 'Concert tickets', remaining: 1500, dueDate: '2026-11-10', money, today }, 'gentle')
check('gentle uses first name, amount, what and date', /^Hi Ana!/.test(gentle) && gentle.includes('₱1,500.00 for Concert tickets') && gentle.includes('due on Nov 10') && gentle.includes('Salamat'), gentle)
const late = utangMessage({ counterparty: 'Ben', remaining: 800, dueDate: '2026-11-01', money, today }, 'direct')
check('direct and overdue', late.startsWith('Hi Ben, reminder lang about the ₱800.00.') && late.includes('due last Nov 1') && late.includes('this week'), late)
const same = utangMessage({ counterparty: 'Carlo', name: 'Carlo', remaining: 200, money, today }, 'gentle')
check('no "for" when the name is the person, no date line', !same.includes(' for ') && !same.includes('due'), same)
check('due today', utangMessage({ counterparty: 'D', remaining: 1, dueDate: '2026-11-07', money, today }, 'gentle').includes('due today'))

// Weekly recap: week of Mon Nov 2 2026 against Oct 26.
const at = (d: number, m = 11) => new Date(2026, m - 1, d, 12).toISOString()
const spends = [
  { date: at(2), amount: 300, category: 'Food' },
  { date: at(2), amount: 200, category: 'Transport' },
  { date: at(4), amount: 1500, category: 'Shopping' },
  { date: at(5), amount: 250, category: 'Food' },
  { date: at(9), amount: 999, category: 'Food' }, // next Monday, ignored
  { date: at(27, 10), amount: 2000, category: 'Food' }, // week before
  { date: at(30, 10), amount: 500, category: 'Food' },
]
const r = weeklyRecap(spends, new Date(2026, 10, 2))
check('week total', r.total === 2250 && r.previous === 2500, r)
check('change', Math.abs((r.change ?? 0) - -0.1) < 1e-9, r.change)
check('top category', r.topCategory?.name === 'Shopping' && r.topCategory.amount === 1500, r.topCategory)
check('biggest day', r.biggestDay?.amount === 1500 && r.biggestDay.date.getDate() === 4, r.biggestDay)
check('no-spend days', r.noSpendDays === 4, r.noSpendDays)

const withAmounts = recapText(r, money, true)
check('recap with amounts', withAmounts.includes('Spent ₱2,250.00') && withAmounts.includes('10% less') && withAmounts.includes('Shopping (67%, ₱1,500.00)') && withAmounts.includes('4 no-spend days'), withAmounts)
const noAmounts = recapText(r, money, false)
check('recap without amounts shows no money', !noAmounts.includes('₱') && noAmounts.includes('Shopping (67%)'), noAmounts)
check('empty week', recapText(weeklyRecap([], new Date(2026, 10, 2)), money, true).includes('No spending'))

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
