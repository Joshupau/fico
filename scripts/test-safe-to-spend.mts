// Run: npx tsx scripts/test-safe-to-spend.mts
import { safeToSpend, instantAnswer, applyTransaction } from '../utils/safe-to-spend'

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++
  else {
    failures++
    console.log('FAIL', label, JSON.stringify(extra))
  }
}
const money = (n: number) => `₱${Math.round(n).toLocaleString('en-US')}`

// Monday Nov 2 2026, noon. Next payday Nov 14.
const today = new Date(2026, 10, 2, 12, 0)
const base = {
  cashBalance: 16400,
  floor: 2000,
  bills: [
    { dueDate: '2026-11-10', amount: 1000 },
    { dueDate: '2026-11-14', amount: 5000 }, // due on payday: covered by that income
    { dueDate: '2026-11-20', amount: 3000 }, // after payday
  ],
  incomes: [
    { date: '2026-11-14', amount: 12500 },
    { date: '2026-11-28', amount: 12500 },
  ],
  spentToday: 0,
  today,
}

const r = safeToSpend(base)
check('next income', r.nextIncomeDate === '2026-11-14', r)
check('12 days to payday', r.days === 12, r)
check('only the bill before payday counts', r.billsBefore === 1000, r)
check('usable', r.usable === 13400, r)
check('per day', Math.round(r.perDay) === 1117, r)
check('left today equals per day when nothing spent', Math.round(r.leftToday) === 1117, r)
check('not short', r.short === false, r)

// Spending 200 today: cash is already 200 lower, per day stays the same, left today drops by 200.
const spent = safeToSpend({ ...base, cashBalance: 16200, spentToday: 200 })
check('per day unchanged by spending today', Math.round(spent.perDay) === Math.round(r.perDay), spent)
check('left today drops by what was spent', Math.round(spent.leftToday) === Math.round(r.leftToday) - 200, spent)

// Overdue bills are still owed.
const overdue = safeToSpend({ ...base, bills: [{ dueDate: '2026-10-25', amount: 2000 }] })
check('overdue bill counts', overdue.billsBefore === 2000, overdue)

// Past or same-day income is ignored; zero-amount ignored.
const none = safeToSpend({ ...base, incomes: [{ date: '2026-11-02', amount: 9999 }, { date: '2026-11-05', amount: 0 }], fallbackDays: 30 })
check('no future income falls back', none.nextIncomeDate === null && none.days === 30, none)

// Short of cash.
const short = safeToSpend({ ...base, cashBalance: 2500 })
check('short flagged', short.short === true && short.perDay === 0, short)
check('short message', (instantAnswer(short, money) ?? '').startsWith('Bills before your next income'), instantAnswer(short, money))

// instantAnswer wording.
check('left wording', instantAnswer(r, money) === '₱1,117 left for today.', instantAnswer(r, money))
const over = safeToSpend({ ...base, cashBalance: 14000, spentToday: 2600 })
check('over wording', /over today's pace/.test(instantAnswer(over, money) ?? ''), instantAnswer(over, money))

// applyTransaction.
const afterExpense = safeToSpend(applyTransaction(base, { type: 'expense', amount: 300, fromCash: true }))
check('expense lowers left today by its amount', Math.round(afterExpense.leftToday) === Math.round(r.leftToday) - 300, afterExpense)
const afterCard = safeToSpend(applyTransaction(base, { type: 'expense', amount: 300, fromCash: false }))
check('card expense counts the same', Math.round(afterCard.leftToday) === Math.round(afterExpense.leftToday), afterCard)
const kept = applyTransaction(base, { type: 'expense', amount: 300, fromCash: true, affectsBalance: false })
check("'don't change balance' is ignored", kept === base)
const afterIncome = safeToSpend(applyTransaction(base, { type: 'income', amount: 1200, fromCash: true }))
check('income raises usable', afterIncome.usable === r.usable + 1200, afterIncome)
const toCard = safeToSpend(applyTransaction(base, { type: 'transfer', amount: 1000, fromCash: true, toCash: false }))
check('paying a card from cash lowers usable', toCard.usable === r.usable - 1000, toCard)
const between = safeToSpend(applyTransaction(base, { type: 'transfer', amount: 1000, fromCash: true, toCash: true }))
check('moving between cash wallets changes nothing', between.usable === r.usable, between)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
