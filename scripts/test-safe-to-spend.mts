// Run: npx tsx scripts/test-safe-to-spend.mts
import { safeToSpend, instantAnswer, applyTransaction, safeToSpendInputs } from '../utils/safe-to-spend'

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
check('left wording', instantAnswer(r, money) === '₱1,117 left for today, ₱13,400 until payday.', instantAnswer(r, money))
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

// safeToSpendInputs: builds the inputs from wallets and open bills, as the Home card and quick add do.
const built = safeToSpendInputs({
  today,
  floor: 500,
  spentToday: 120,
  wallets: [
    { type: 'cash', balance: 1000 },
    { type: 'ewallet', balance: '2500' },
    { type: 'bank', balance: 8000 },
    { type: 'savings', balance: 50000 }, // not spending money
    { type: 'credit_card', balance: 3000 }, // owed, not cash
    { type: 'bank', balance: 9999, status: 'archived' },
  ],
  openBills: [
    { id: 'a', type: 'bill', name: 'Internet', amount: 1500, paidAmount: 500, dueDate: '2026-11-08', isRecurring: true, recurringFrequency: 'monthly', paymentStatus: 'partial' },
    { id: 'b', type: 'bill', name: 'Rent', amount: 6000, dueDate: '2026-10-30', isRecurring: false, paymentStatus: 'overdue' },
    { id: 'c', type: 'income', name: 'Salary', amount: 20000, dueDate: '2026-11-15', isRecurring: true, recurringFrequency: 'biweekly', paymentStatus: 'unpaid' },
  ],
})
check('cash counts bank, cash and e-wallets only', built.cashBalance === 11500, built)
check('partly paid bill counts what is left', built.bills.some((b) => b.dueDate === '2026-11-08' && b.amount === 1000), built.bills)
check('recurring bill repeats at full amount', built.bills.some((b) => b.dueDate === '2026-12-08' && b.amount === 1500), built.bills)
check('overdue bill kept', built.bills.some((b) => b.dueDate === '2026-10-30' && b.amount === 6000), built.bills)
check('recurring income expands', built.incomes.some((i) => i.date === '2026-11-29'), built.incomes)
check('month-end fallback', built.fallbackDays === 28, built.fallbackDays)
const fromBuilt = safeToSpend(built)
check('payday from income bills', fromBuilt.nextIncomeDate === '2026-11-15' && fromBuilt.days === 13, fromBuilt)
check('bills before payday', fromBuilt.billsBefore === 7000, fromBuilt)
check('usable after floor and bills', fromBuilt.usable === 11500 - 500 - 7000, fromBuilt)

// Your own wallet choices: a minimum kept in a bank, a bank used for saving, and planned spending.
const chosen = safeToSpendInputs({
  today,
  wallets: [
    { id: 'bdo', type: 'bank', balance: 4103.77 },
    { id: 'gcash', type: 'ewallet', balance: 1119.82 },
    { id: 'cash', type: 'cash', balance: 1510 },
    { id: 'gotyme', type: 'bank', balance: 500 },
    { id: 'ef', type: 'savings', balance: 10150.63 },
  ],
  rules: { bdo: { min: 2000 }, gotyme: { include: false } },
  openBills: [],
  planned: [
    { type: 'expense', date: '2026-11-10', amountLow: 900, amountHigh: 1500 },
    { type: 'income', date: '2026-11-09', amountLow: 5000, amountHigh: 10000 },
    { type: 'expense', date: '2026-10-01', amountHigh: 999 },
  ],
})
check('bank minimum kept back', Math.round(chosen.cashBalance * 100) === Math.round((2103.77 + 1119.82 + 1510) * 100), chosen.cashBalance)
check('wallet switched off is left out, savings stay out', chosen.cashBalance < 5000, chosen.cashBalance)
check('planned expense counts at its high estimate', chosen.bills.some((b) => b.dueDate === '2026-11-10' && b.amount === 1500), chosen.bills)
check('planned income is not counted', chosen.incomes.length === 0, chosen.incomes)
check('past planned expense ignored', !chosen.bills.some((b) => b.dueDate === '2026-10-01'), chosen.bills)
const savingsOn = safeToSpendInputs({ today, wallets: [{ id: 'ef', type: 'savings', balance: 100 }], rules: { ef: { include: true } }, openBills: [] })
check('a savings wallet can be switched on', savingsOn.cashBalance === 100, savingsOn)
const belowMin = safeToSpendInputs({ today, wallets: [{ id: 'bdo', type: 'bank', balance: 1500 }], rules: { bdo: { min: 2000 } }, openBills: [] })
check('below its minimum a wallet gives nothing, not less than nothing', belowMin.cashBalance === 0, belowMin)

// Turning a wallet off drops its spending today too, not only its balance.
const spentWallets = [
  { id: 'gcash', type: 'ewallet', balance: 339.82 },
  { id: 'cash', type: 'cash', balance: 1470 },
  { id: 'card', type: 'credit_card', balance: 0 },
  { id: 'ef', type: 'savings', balance: 10000 },
]
const byWallet = { gcash: 780, cash: 40, card: 100, ef: 50, gone: 10 }
const allOn = safeToSpendInputs({ today, wallets: spentWallets, openBills: [], spentToday: 980, spentByWallet: byWallet })
check('spending from savings is left out', allOn.spentToday === 930, allOn.spentToday)
const gcashOff = safeToSpendInputs({ today, wallets: spentWallets, rules: { gcash: { include: false } }, openBills: [], spentToday: 980, spentByWallet: byWallet })
check('wallet switched off drops its spending; card and unknown wallets still count', gcashOff.spentToday === 150, gcashOff.spentToday)
check('wallet switched off drops its balance', gcashOff.cashBalance === 1470, gcashOff.cashBalance)
const noBreakdown = safeToSpendInputs({ today, wallets: spentWallets, openBills: [], spentToday: 980 })
check('without a per-wallet breakdown the total is used', noBreakdown.spentToday === 980, noBreakdown.spentToday)
const offExpense = applyTransaction(base, { type: 'expense', amount: 500, fromCash: false, fromExcluded: true })
check('spending from a switched-off wallet changes nothing', offExpense.cashBalance === base.cashBalance && offExpense.spentToday === 0, offExpense)

// The card lists the bills behind "Until payday", and the next one after it.
const listed = safeToSpend({
  ...base,
  bills: [
    { dueDate: '2026-11-20', amount: 3000, name: 'Rent' },
    { dueDate: '2026-11-10', amount: 1000, name: 'Globe' },
    { dueDate: '2026-10-30', amount: 450, name: 'Meralco' },
    { dueDate: '2026-11-14', amount: 5000, name: 'Card' },
    { dueDate: '2026-11-11', amount: 0, name: 'Paid off' },
  ],
})
check('bills due listed soonest first, overdue leads', listed.billsDue.map((b) => b.name).join() === 'Meralco,Globe', listed.billsDue)
check('listed bills add up to billsBefore', listed.billsBefore === 1450, listed.billsBefore)
check('next bill is the one due on payday', listed.nextBill?.name === 'Card', listed.nextBill)
const noneBefore = safeToSpend({ ...base, bills: [{ dueDate: '2026-11-20', amount: 3000, name: 'Rent' }] })
check('no bills before payday', noneBefore.billsDue.length === 0 && noneBefore.nextBill?.name === 'Rent', noneBefore)
const named = safeToSpendInputs({
  today,
  wallets: [],
  openBills: [{ id: 'b', type: 'bill', name: 'Globe', amount: 999, dueDate: '2026-11-10', isRecurring: false, paymentStatus: 'unpaid' }],
  planned: [{ type: 'expense', date: '2026-11-12', amountHigh: 1500, name: 'Birthday gift' }],
})
check('bill and planned names carried', named.bills.map((b) => b.name).join() === 'Globe,Birthday gift', named.bills)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
