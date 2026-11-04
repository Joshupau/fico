// Lending and repayments are not spending (fico-api 0065): money lent and paid back the same day
// leaves "spent today" and Money in / Money out alone, while wallet balances still move.
// Runs the real schema in PGlite. Run: npx tsx scripts/test-lending.mts
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'

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

const gcash = (await from('wallets').insert({ name: 'GCash', type: 'ewallet', balance: 10000 }).select().single()).data.id
const cash = (await from('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()).data.id
const now = new Date().toISOString()
const balance = async (id: string) => Number((await from('wallets').select('balance').eq('id', id).single()).data.balance)

await rpc('transactions_create', { p_wallet_id: gcash, p_amount: 780, p_type: 'expense', p_date: now })
await rpc('transactions_create', { p_wallet_id: cash, p_amount: 40, p_type: 'expense', p_date: now })

const lent = await rpc('obligations_create', {
  p_direction: 'lending', p_name: 'Borrow', p_counterparty: 'Randell', p_principal_amount: 7000, p_start_date: now, p_wallet_id: gcash,
})
check('lend 7,000 from GCash', !lent.error, lent.error)
check('GCash balance drops by 7,000', (await balance(gcash)) === 10000 - 780 - 7000, await balance(gcash))
const paid = await rpc('obligations_record_payment', { p_id: lent.data.id, p_amount: 7000, p_wallet_id: gcash, p_date: now })
check('repaid 7,000 to GCash', !paid.error, paid.error)
check('GCash balance is back', (await balance(gcash)) === 10000 - 780, await balance(gcash))

const linked = (await from('transactions').select('id, obligation_id').eq('obligation_id', lent.data.id)).data
check('both lending rows are linked to the loan', linked.length === 2, linked)

const spent = (await rpc('transactions_spent_today')).data
check('spent today leaves lending out', Number(spent.totalSpent) === 820, spent)
check('spent today per wallet', Number(spent.byWallet[gcash]) === 780 && Number(spent.byWallet[cash]) === 40, spent.byWallet)

const stats = (await rpc('reports_quick_stats', { p_period: 'today' })).data
check('money in / out leave lending out', Number(stats.income) === 0 && Number(stats.expenses) === 820, stats)

// A loan you took and paid back is not income or spending either.
const borrowed = await rpc('obligations_create', {
  p_direction: 'debt', p_name: 'Short', p_counterparty: 'Mom', p_principal_amount: 500, p_start_date: now, p_wallet_id: cash,
})
await rpc('obligations_record_payment', { p_id: borrowed.data.id, p_amount: 500, p_wallet_id: cash, p_date: now })
const spent2 = (await rpc('transactions_spent_today')).data
check('paying back a loan is not spending', Number(spent2.totalSpent) === 820, spent2)

if (failures) {
  console.log(`${failures} failed`)
  process.exit(1)
}
console.log('all passed')
