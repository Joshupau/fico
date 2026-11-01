// Exercises the local engine against the real schema in PGlite (Node). Run: npx tsx scripts/test-engine.mts
import { PGlite } from '@electric-sql/pglite'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'

const UID = '11111111-1111-1111-1111-111111111111'
const db = new PGlite()
for (const s of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) await db.exec(s)
await db.exec(`set session_replication_role = replica; insert into auth.users (id, email) values ('${UID}', 'a@b.c'); insert into public.profiles (id, username) values ('${UID}', 'tester'); set session_replication_role = origin`)
await db.exec(`select set_config('app.user_id', '${UID}', false)`)

let queued = 0
const engine = new LocalEngine(db as unknown as Db, await loadCatalog(db as unknown as Db), () => queued++)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (t: string) => recordingBuilder([], (c) => engine.execute('table', t, c)) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => engine.execute('rpc', n, c)) as any
let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// wallets: insert + select single
const w = await from('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()
check('insert wallet returns row with id + numeric balance', !w.error && typeof w.data.id === 'string' && w.data.balance === 1000, w)
await from('wallets').insert({ name: 'Bank', type: 'bank', balance: 500 }).select().single()
check('wallet writes queued', queued === 2, queued)

// category (rpc) + transaction (rpc) with embeds
const cat = await rpc('categories_create', { p_name: 'Food', p_type: 'expense' })
check('categories_create', !cat.error && cat.data?.name === 'Food', cat)
const tx = await rpc('transactions_create', { p_wallet_id: w.data.id, p_amount: 150, p_type: 'expense', p_category_id: cat.data.id, p_description: 'coffee', p_date: new Date().toISOString(), p_tags: ['x'], p_attachments: [] })
check('transactions_create', !tx.error && tx.data?.amount === 150, tx)
const list = await from('transactions')
  .select('*, wallet:wallets!transactions_wallet_id_fkey(name,type,currency), category:categories(name,type), to_wallet:wallets!transactions_to_wallet_id_fkey(name)', { count: 'exact' })
  .eq('status', 'completed')
  .overlaps('tags', ['x'])
  .order('date', { ascending: false })
  .range(0, 9)
check('list with embeds + count', !list.error && list.count === 1 && list.data[0].wallet.name === 'Cash' && list.data[0].category.name === 'Food' && list.data[0].to_wallet === null, list)
const after = await from('wallets').select('balance').eq('id', w.data.id).single()
check('wallet balance debited by RPC', after.data?.balance === 850, after)

// filters
const ilike = await from('transactions').select('id').ilike('description', '%COF%')
check('ilike', ilike.data?.length === 1, ilike)
await rpc('transactions_create', { p_wallet_id: w.data.id, p_amount: 20, p_type: 'expense', p_description: 'no category', p_date: new Date().toISOString() })
const uncat = await from('transactions').select('description').is('category_id', null).neq('type', 'transfer')
const byCat = await from('transactions').select('description').eq('category_id', cat.data.id)
check('category and uncategorized filters', uncat.data?.length === 1 && uncat.data[0].description === 'no category' && byCat.data?.length === 1, { uncat, byCat })
const orr = await from('transactions').select('id').or(`wallet_id.eq.${w.data.id},to_wallet_id.eq.${w.data.id}`).limit(1)
check('or()', orr.data?.length === 1, orr)
const inn = await from('wallets').select('id,name').in('name', ['Cash', 'Bank']).order('name')
check('in()', inn.data?.length === 2 && inn.data[0].name === 'Bank', inn)
const head = await from('categories').select('*', { count: 'exact', head: true }).not('owner_id', 'is', null)
check('head count', head.data === null && head.count === 1, head)

// bills: recurring income, mark paid, summary, embeds
const bill = await rpc('bills_create', { p_name: 'Salary', p_amount: 5000, p_due_date: new Date().toISOString(), p_is_recurring: true, p_type: 'income', p_recurring_frequency: 'biweekly', p_wallet_id: w.data.id })
check('bills_create biweekly', !bill.error && bill.data.recurring_frequency === 'biweekly', bill)
const before = queued
const summary = await rpc('bills_summary')
check('read-only rpc not queued', queued === before && summary.data?.totalBills === 1, { queued, before })
const paid = await rpc('bills_mark_paid', { p_id: bill.data.id })
check('bills_mark_paid', !paid.error, paid)
const sum2 = await rpc('bills_summary')
check('summary amounts present', sum2.data.paidAmount === 5000, sum2.data)
const bl = await from('bills')
  .select('*, category:categories(name), wallet:wallets!bills_wallet_id_fkey(name,type)', { count: 'exact' })
  .eq('status', 'active')
  .order('due_date', { ascending: true })
  .range(0, 19)
check('bills list', !bl.error && bl.count === 2 && bl.data[0].wallet.name === 'Cash', bl)

// Bills page groups: still-due and settled bills page separately; archived bills can come back.
const dueQ = await from('bills').select('id, payment_status', { count: 'exact' }).eq('status', 'active').in('payment_status', ['unpaid', 'overdue', 'partial'])
const setQ = await from('bills').select('id, payment_status', { count: 'exact' }).eq('status', 'active').in('payment_status', ['paid', 'received'])
check('due and settled bills list apart', dueQ.count === 1 && setQ.count === 1 && setQ.data[0].id === bill.data.id, { dueQ, setQ })
const rent = await rpc('bills_create', { p_name: 'Rent', p_amount: 300, p_due_date: new Date().toISOString(), p_is_recurring: false, p_type: 'bill', p_wallet_id: w.data.id })
await rpc('bills_archive', { p_id: rent.data.id })
const archivedTx = await from('transactions').select('id').eq('bill_id', rent.data.id)
check('archiving drops the pending transaction', archivedTx.data?.length === 0, archivedTx)
const un = await rpc('bills_unarchive', { p_id: rent.data.id })
const back = await from('bills').select('status, payment_status, transaction_id').eq('id', rent.data.id).single()
const pendingTx = await from('transactions').select('id, status, amount').eq('bill_id', rent.data.id)
check('bills_unarchive restores the bill and its pending transaction', !un.error && back.data?.status === 'active' && back.data?.payment_status === 'unpaid' && pendingTx.data?.length === 1 && pendingTx.data[0].status === 'pending' && pendingTx.data[0].id === back.data.transaction_id, { un, back, pendingTx })

// planned items: plain table writes, as queries/user/planned/planned-items.ts makes them
const qp = queued
const pi = await from('planned_items').insert({ name: '13th month', type: 'income', amount_low: 20000, amount_high: 22000, date: '2026-12-15', status: 'expected', category_id: null, notes: null })
check('insert planned item is queued for sync', pi.error === null && queued === qp + 1, { pi, queued, qp })
const pl = await from('planned_items').select('*, category:categories(name,icon,color)').order('date', { ascending: true })
check('list planned items', !pl.error && pl.data.length === 1 && pl.data[0].owner_id === UID && pl.data[0].amount_high === 22000 && pl.data[0].category === null, pl)
await from('planned_items').update({ status: 'confirmed', amount_low: 21000 }).eq('id', pl.data[0].id)
const pu = await from('planned_items').select('status, amount_low').eq('id', pl.data[0].id).single()
check('update planned item', pu.data?.status === 'confirmed' && pu.data?.amount_low === 21000, pu)
const bad = await from('planned_items').insert({ name: 'Backwards', type: 'income', amount_low: 5, amount_high: 1, date: '2026-12-01' })
check('planned item range checked', !!bad.error, bad)
await from('planned_items').delete().eq('id', pl.data[0].id)
const pd = await from('planned_items').select('id')
check('delete planned item', pd.data?.length === 0, pd)

// update / delete / errors
const up = await from('categories').update({ status: 'archived' }).eq('id', cat.data.id)
check('update without select -> data null', up.error === null && up.data === null, up)
const q0 = queued
await from('categories').update({ status: 'archived' }).eq('id', '99999999-9999-9999-9999-999999999999')
check('update matching nothing is not queued', queued === q0, { queued, q0 })
const err = await from('transactions').insert({ wallet_id: 'nope' })
check('error shape', err.error && typeof err.error.message === 'string', err)
const sav = await from('wallets').insert({ name: 'Sav', type: 'savings', balance: 100 }).select().single()
const blocked = await rpc('transactions_create', { p_wallet_id: sav.data.id, p_amount: 5, p_type: 'expense', p_date: new Date().toISOString() })
check('savings expense blocked with message', blocked.error?.message?.includes("can't pay directly"), blocked)
const none = await from('wallets').select('*').eq('id', '99999999-9999-9999-9999-999999999999').maybeSingle()
check('maybeSingle none -> null', none.error === null && none.data === null, none)
const sErr = await from('wallets').select('*').eq('id', '99999999-9999-9999-9999-999999999999').single()
check('single none -> PGRST116', sErr.error?.code === 'PGRST116', sErr)

// reports and other RPCs used by the app
for (const [name, args] of [
  ['reports_monthly', { p_year: 2026 }],
  ['reports_quick_stats', { p_period: 'month' }],
  ['budgets_summary', {}],
  ['transactions_all_tags', {}],
  ['obligations_summary', {}],
  ['investments_summary', {}],
  ['budgets_list', {}],
] as const) {
  const r = await rpc(name, args as object)
  check(`rpc ${name}`, !r.error, r.error)
}
// Weekly savings interest: each of 7 Manila days earns rate/365 on that day's closing balance, minus tax.
// The week starts 8 days ago (so it has closed). 10,000 for its first 4 days; 5,000 more lands at
// 11 PM on day 5, so days 5-7 close at 15,000. 3% a year, 20% tax.
const manilaDay = (offset: number) => `((now() at time zone 'Asia/Manila')::date + ${offset})::timestamp`
await db.exec(`set session_replication_role = replica`)
const sv = (await db.query<{ id: string }>(
  `insert into public.wallets (owner_id, name, type, balance, interest_rate, interest_payout, interest_tax_rate, interest_last_posted_at)
   values ('${UID}', 'GoTyme Savings', 'savings', 15000, 3, 'weekly', 20, ${manilaDay(-8)} at time zone 'Asia/Manila') returning id`
)).rows[0].id
await db.query(
  `insert into public.transactions (owner_id, wallet_id, amount, type, description, date, status)
   values ('${UID}', $1, 5000, 'income', 'top up', (${manilaDay(-4)} + interval '23 hours') at time zone 'Asia/Manila', 'completed')`,
  [sv]
)
await db.exec(`set session_replication_role = origin`)
await db.query(`select public.post_savings_interest()`)
const interest = (await db.query<{ amount: number; balance: number; earned: number }>(
  `select t.amount::float as amount, w.balance::float as balance, w.total_interest_earned::float as earned
   from public.transactions t join public.wallets w on w.id = t.wallet_id
   where t.wallet_id = $1 and 'interest' = any(t.tags)`,
  [sv]
)).rows
const expected = Math.round(((4 * 10000 + 3 * 15000) * 0.03) / 365 * 0.8 * 100) / 100
check('weekly interest counts each day on its own balance', interest.length === 1 && interest[0].amount === expected && interest[0].earned === expected && interest[0].balance === 15000 + expected, { interest, expected })
await db.query(`select public.post_savings_interest()`)
const again = (await db.query<{ n: number }>(`select count(*)::int as n from public.transactions where wallet_id = $1 and 'interest' = any(tags)`, [sv])).rows[0].n
check('weekly interest posts once per week', again === 1, again)

// Monthly budgets move on to the current month by themselves once their period ends.
await db.exec(`set session_replication_role = replica`)
const oldBudget = (await db.query<{ id: string }>(
  `insert into public.budgets (owner_id, name, amount, spent, period, start_date, end_date, status, category_ids)
   values ('${UID}', 'Old month', 1000, 999, 'monthly',
     (date_trunc('month', now() at time zone 'Asia/Manila') - interval '3 months') at time zone 'Asia/Manila',
     (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila',
     'exceeded', '{}') returning id`
)).rows[0].id
await db.exec(`set session_replication_role = origin`)
const bsum = await rpc('budgets_summary')
check('budgets_summary runs with the period advance', !bsum.error, bsum.error)
const moved = (await db.query<{ ok: boolean; status: string; spent: number }>(
  `select start_date = date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
      and end_date = (date_trunc('month', now() at time zone 'Asia/Manila') + interval '1 month') at time zone 'Asia/Manila' as ok,
      status::text as status, spent::float as spent
   from public.budgets where id = $1`,
  [oldBudget]
)).rows[0]
check('ended monthly budget advances to this month and recounts', moved.ok && moved.spent < 999, moved)

const outbox = await db.query<{ kind: string }>('select kind from public._sync_outbox order by seq')
console.log('outbox entries:', outbox.rows.length)
console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
