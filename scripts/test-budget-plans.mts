// Budget plans (fico-api 0066) and "how much you can save" (utils/budget-plans.ts).
// Runs the real schema in PGlite for the tables, then checks the calculations.
// Run: npx tsx scripts/test-budget-plans.mts
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'
import { monthBudgetLines, planStatus, savingsSummary, savedInto, receivedIncome, type MonthTxn, type PlanBudget } from '../utils/budget-plans'
import type { BudgetPlan } from '../types/budget-plan'

const UID = '11111111-1111-1111-1111-111111111111'
const db = new PGlite()
for (const s of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) await db.exec(s)
await db.exec(`set session_replication_role = replica; insert into auth.users (id, email) values ('${UID}', 'a@b.c'); insert into public.profiles (id, username) values ('${UID}', 'tester'); set session_replication_role = origin`)
await db.exec(`select set_config('app.user_id', '${UID}', false)`)

const engine = new LocalEngine(db as unknown as Db, await loadCatalog(db as unknown as Db), () => {})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => recordingBuilder([], (c) => engine.execute('table', t, c)) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => engine.execute('rpc', n, c)) as any
let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// --- tables ------------------------------------------------------------------------------------
const planId = 'aaaaaaaa-0000-4000-8000-000000000001'
const needsId = 'aaaaaaaa-0000-4000-8000-000000000002'
const plan = await from('budget_plans').insert({ id: planId, name: '50/30/20', income: 50000 })
check('create a plan', !plan.error, plan.error)
const group = await from('budget_plan_groups').insert({ id: needsId, plan_id: planId, name: 'Needs', kind: 'spend', percent: 50 })
check('create a group', !group.error, group.error)
const bad = await from('budget_plan_groups').insert({ plan_id: planId, name: 'Too much', kind: 'spend', percent: 150 })
check('a group can be at most 100%', !!bad.error)

const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1)
const created = await rpc('budgets_create', {
  p_name: 'Groceries', p_amount: 8000, p_period: 'monthly', p_start_date: lastMonth.toISOString(), p_end_date: lastMonthEnd.toISOString(), p_category_ids: [],
})
check('create a budget', !created.error, created.error)
const budgetId = created.data.id
const moved = await from('budgets').update({ group_id: needsId }).eq('id', budgetId)
check('put the budget in Needs', !moved.error, moved.error)

await rpc('budgets_list', { p_page: 0, p_limit: 100 })
const rows = (await from('budgets').select('id, group_id, next_budget_id, start_date').order('start_date', { ascending: true })).data
check('last month rolled into a new period', rows.length >= 2, rows)
check('the new period stays in Needs', rows.every((r: { group_id: string }) => r.group_id === needsId), rows)

await from('budget_plans').delete().eq('id', planId)
const after = (await from('budgets').select('group_id')).data
check('deleting the plan keeps its budgets, ungrouped', after.length === rows.length && after.every((r: { group_id: string | null }) => r.group_id === null), after)
const groupsLeft = (await from('budget_plan_groups').select('id')).data
check('deleting the plan deletes its groups', groupsLeft.length === 0, groupsLeft)

// --- calculations --------------------------------------------------------------------------------
const month = new Date(2026, 10, 1) // November 2026: 30 days
const budgets: PlanBudget[] = [
  { id: 'rent', name: 'Rent', amount: 15000, spent: 15000, period: 'monthly', categoryIds: ['c1'], groupId: 'needs' },
  { id: 'food', name: 'Food', amount: 8000, spent: 9000, period: 'monthly', categoryIds: ['c2'], groupId: 'needs' },
  { id: 'fun-w1', name: 'Fun', amount: 700, spent: 600, period: 'weekly', categoryIds: ['c3'], groupId: 'wants', startDate: '2026-11-02' },
  { id: 'fun-w2', name: 'Fun', amount: 700, spent: 300, period: 'weekly', categoryIds: ['c3'], groupId: 'wants', startDate: '2026-11-09' },
  { id: 'gym', name: 'Gym', amount: 12000, spent: 1000, period: 'yearly', categoryIds: ['c4'], groupId: null },
]
const lines = monthBudgetLines(budgets, month, { gym: 1000 })
check('weekly rows of one budget are one line', lines.length === 4, lines)
const fun = lines.find((l) => l.name === 'Fun')!
check('weekly limit scales to the month', Math.round(fun.limit) === 3000 && fun.spent === 900 && fun.id === 'fun-w2' && fun.rowIds.length === 2, fun)
check('yearly limit is a twelfth', lines.find((l) => l.id === 'gym')!.limit === 1000)

const SAV = 'sav'
const txns: MonthTxn[] = [
  { type: 'income', amount: 30000, walletId: 'bank' },
  { type: 'income', amount: 7000, walletId: 'bank', obligationId: 'loan' }, // repayment, not income
  { type: 'transfer', amount: 5000, walletId: 'bank', toWalletId: SAV },
  { type: 'transfer', amount: 1000, walletId: SAV, toWalletId: 'gcash' },
  { type: 'income', amount: 25, walletId: SAV }, // interest
  { type: 'expense', amount: 500, walletId: 'gcash' },
]
check('repayments are not income', receivedIncome(txns) === 30025, receivedIncome(txns))
check('saved = in - out of savings wallets', savedInto(txns, new Set([SAV])) === 4025, savedInto(txns, new Set([SAV])))

const summary = savingsSummary({ lines, txns, incomeStillDue: 20000, savingsWalletIds: new Set([SAV]) })
// committed: rent 15000 + food max(8000, 9000) + fun 3000 + gym 1000 = 28000
check('income = received + still due', summary.income === 50025, summary)
check('can save = income - budgets (overspending counts)', Math.round(summary.canSave) === 50025 - 28000, summary)

const planData: BudgetPlan = {
  id: 'p', name: '50/30/20', income: 50000, color: null, status: 'active', sortOrder: 0, createdAt: '',
  groups: [
    { id: 'needs', planId: 'p', name: 'Needs', kind: 'spend', percent: 50, amount: null, color: null, icon: null, walletIds: [], sortOrder: 0 },
    { id: 'wants', planId: 'p', name: 'Wants', kind: 'spend', percent: 30, amount: null, color: null, icon: null, walletIds: [], sortOrder: 1 },
    { id: 'save', planId: 'p', name: 'Emergency fund', kind: 'save', percent: null, amount: 10000, color: null, icon: null, walletIds: [], sortOrder: 2 },
  ],
}
const status = planStatus({ plan: planData, lines, txns, monthIncome: summary.income, savingsWalletIds: new Set([SAV]) })
check('targets from the plan income', status.groups.map((g) => g.target).join() === '25000,15000,10000', status.groups.map((g) => g.target))
check('needs spent = its budgets', status.groups[0].progress === 24000, status.groups[0])
check('savings group counts money into savings', status.groups[2].progress === 4025, status.groups[2])
check('spend target = needs + wants', status.spendTarget === 40000)
check('plan can save = income - spending groups', Math.round(status.canSave) === 50000 - (24000 + 3000), status.canSave)
const noIncome = planStatus({ plan: { ...planData, income: null }, lines, txns, monthIncome: 40000, savingsWalletIds: new Set([SAV]) })
check('no plan income uses the month income', noIncome.usesMonthIncome && noIncome.groups[0].target === 20000, noIncome.groups[0])

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall budget plan checks passed')
