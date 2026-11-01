// "Don't change wallet balance" (transactions.affects_balance, fico-api 0061): create, edit, delete,
// flag switches and the bulk date-range update, checking every wallet balance after each step.
// Runs the real schema in PGlite. Run: npx tsx scripts/test-affects-balance.mts
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

const cash = (await from('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()).data.id
const bank = (await from('wallets').insert({ name: 'Bank', type: 'bank', balance: 500 }).select().single()).data.id
const card = (await from('wallets').insert({ name: 'Card', type: 'credit_card', balance: 0, credit_limit: 10000 }).select().single()).data.id

const balances = async () => {
  const { data } = await from('wallets').select('id, balance')
  const by: Record<string, number> = {}
  for (const w of data) by[w.id] = Number(w.balance)
  return { cash: by[cash], bank: by[bank], card: by[card] }
}
const expect = async (label: string, want: { cash: number; bank: number; card: number }) => {
  const got = await balances()
  check(label, got.cash === want.cash && got.bank === want.bank && got.card === want.card, { got, want })
}
const day = (d: string) => new Date(`${d}T12:00:00Z`).toISOString()
const create = (args: object) => rpc('transactions_create', { p_date: day('2026-10-01'), ...args })
const update = (args: object) => rpc('transactions_update', args)

// --- create ---
const normal = await create({ p_wallet_id: cash, p_amount: 100, p_type: 'expense' })
check('create normal expense', !normal.error && normal.data.affects_balance === true, normal)
await expect('normal expense takes 100 from Cash', { cash: 900, bank: 500, card: 0 })

const hist = await create({ p_wallet_id: cash, p_amount: 5000, p_type: 'expense', p_affects_balance: false, p_date: day('2026-02-10') })
check('create history expense larger than the balance is allowed', !hist.error && hist.data.affects_balance === false, hist)
await expect('history expense leaves balances alone', { cash: 900, bank: 500, card: 0 })

const histTransfer = await create({ p_wallet_id: cash, p_to_wallet_id: bank, p_amount: 50, p_type: 'transfer', p_service_fee: 5, p_affects_balance: false, p_date: day('2026-03-05') })
check('create history transfer', !histTransfer.error, histTransfer)
await expect('history transfer with fee leaves balances alone', { cash: 900, bank: 500, card: 0 })

// --- edit while the flag is off: nothing moves ---
await update({ p_id: hist.data.id, p_amount: 7000 })
await expect('history: amount edit moves nothing', { cash: 900, bank: 500, card: 0 })
await update({ p_id: hist.data.id, p_wallet_id: bank })
await expect('history: wallet edit moves nothing', { cash: 900, bank: 500, card: 0 })
await update({ p_id: hist.data.id, p_type: 'income' })
await expect('history: type edit moves nothing', { cash: 900, bank: 500, card: 0 })
await update({ p_id: hist.data.id, p_date: day('2026-01-15') })
await expect('history: date edit moves nothing', { cash: 900, bank: 500, card: 0 })
await update({ p_id: hist.data.id, p_type: 'expense', p_wallet_id: cash, p_amount: 5000 })

// --- edit while the flag is on: old effect swapped for the new one ---
await update({ p_id: normal.data.id, p_amount: 150 })
await expect('normal: amount 100 -> 150 takes 50 more', { cash: 850, bank: 500, card: 0 })
await update({ p_id: normal.data.id, p_amount: 150 })
await expect('normal: same edit again changes nothing (idempotent)', { cash: 850, bank: 500, card: 0 })
await update({ p_id: normal.data.id, p_wallet_id: bank })
await expect('normal: wallet Cash -> Bank moves the 150', { cash: 1000, bank: 350, card: 0 })
await update({ p_id: normal.data.id, p_date: day('2026-01-01') })
await expect('normal: date edit alone moves nothing', { cash: 1000, bank: 350, card: 0 })
await update({ p_id: normal.data.id, p_type: 'income' })
await expect('normal: expense -> income swaps the sign', { cash: 1000, bank: 650, card: 0 })
await update({ p_id: normal.data.id, p_type: 'transfer', p_to_wallet_id: cash })
await expect('normal: income -> transfer Bank to Cash', { cash: 1150, bank: 350, card: 0 })
await update({ p_id: normal.data.id, p_type: 'expense', p_wallet_id: cash })
const asExpense = await from('transactions').select('to_wallet_id').eq('id', normal.data.id).single()
check('changing away from transfer clears the destination', asExpense.data.to_wallet_id === null, asExpense)
await expect('normal: back to a 150 expense on Cash', { cash: 850, bank: 500, card: 0 })
await update({ p_id: normal.data.id, p_status: 'cancelled' })
await expect('normal: cancelling puts the 150 back', { cash: 1000, bank: 500, card: 0 })
await update({ p_id: normal.data.id, p_status: 'completed' })
await expect('normal: completing again takes it out', { cash: 850, bank: 500, card: 0 })
const bad = await update({ p_id: normal.data.id, p_type: 'transfer', p_to_wallet_id: cash })
check('transfer to the same wallet is refused', !!bad.error, bad)
await expect('refused edit leaves balances alone', { cash: 850, bank: 500, card: 0 })

// --- credit card ---
const charge = await create({ p_wallet_id: card, p_amount: 300, p_type: 'expense' })
await expect('card charge raises what is owed', { cash: 850, bank: 500, card: 300 })
await update({ p_id: charge.data.id, p_amount: 200 })
await expect('card charge edit 300 -> 200', { cash: 850, bank: 500, card: 200 })

// --- switching the flag: the full amount, once ---
await update({ p_id: normal.data.id, p_affects_balance: false })
await expect('switch off puts the 150 back', { cash: 1000, bank: 500, card: 200 })
await update({ p_id: normal.data.id, p_affects_balance: false })
await expect('switch off again changes nothing', { cash: 1000, bank: 500, card: 200 })
await update({ p_id: normal.data.id, p_affects_balance: true, p_amount: 120 })
await expect('switch on with a new amount takes the new 120 once', { cash: 880, bank: 500, card: 200 })
await update({ p_id: charge.data.id, p_affects_balance: false })
await expect('card switch off removes the 200 owed', { cash: 880, bank: 500, card: 0 })
await update({ p_id: histTransfer.data.id, p_affects_balance: true })
await expect('history transfer switched on moves 55 out and 50 in', { cash: 825, bank: 550, card: 0 })

// --- delete ---
await rpc('transactions_delete', { p_id: histTransfer.data.id })
await expect('delete balance-affecting transfer reverses it', { cash: 880, bank: 500, card: 0 })
await rpc('transactions_delete', { p_id: hist.data.id })
await expect('delete history row moves nothing', { cash: 880, bank: 500, card: 0 })
await rpc('transactions_delete', { p_id: charge.data.id })
await expect('delete switched-off card charge moves nothing', { cash: 880, bank: 500, card: 0 })

// --- import ---
const imp = await rpc('transactions_bulk_import', { p_wallet_id: bank, p_rows: [
  { date: day('2026-02-01'), amount: 40, type: 'expense', description: 'imported' },
  { date: day('2026-03-31'), amount: 60, type: 'income', description: 'imported' },
] })
check('bulk import', !imp.error && imp.data.imported === 2, imp)
const imported = await from('transactions').select('id, affects_balance').eq('description', 'imported')
check('imported rows are marked as not changing the balance', imported.data.every((t: { affects_balance: boolean }) => !t.affects_balance), imported)
await expect('import moves nothing', { cash: 880, bank: 500, card: 0 })
await rpc('transactions_delete', { p_id: imported.data[0].id })
await expect('deleting an imported row moves nothing', { cash: 880, bank: 500, card: 0 })

// --- bulk date range ---
const q1a = await create({ p_wallet_id: cash, p_amount: 30, p_type: 'expense', p_date: day('2026-01-20') })
const q1b = await create({ p_wallet_id: bank, p_amount: 70, p_type: 'income', p_date: day('2026-03-31') })
const apr = await create({ p_wallet_id: cash, p_amount: 10, p_type: 'expense', p_date: day('2026-04-01') })
await expect('Q1 + April rows applied', { cash: 840, bank: 570, card: 0 })
const range = { p_start: new Date('2026-01-01T00:00:00Z').toISOString(), p_end: new Date('2026-03-31T23:59:59.999Z').toISOString() }
const off = await rpc('transactions_set_affects_balance', { ...range, p_affects_balance: false })
check('bulk off counts only rows that changed', !off.error && off.data.updated === 3, off)
await expect('bulk off (default) keeps every balance as it is', { cash: 840, bank: 570, card: 0 })
const flags = await from('transactions').select('id, affects_balance').in('id', [q1a.data.id, q1b.data.id, apr.data.id])
const flagOf = (id: string) => flags.data.find((t: { id: string }) => t.id === id).affects_balance
check('only rows inside the range were switched', !flagOf(q1a.data.id) && !flagOf(q1b.data.id) && flagOf(apr.data.id), flags)
const again = await rpc('transactions_set_affects_balance', { ...range, p_affects_balance: false })
check('bulk off again is a no-op', again.data.updated === 0, again)
await update({ p_id: q1a.data.id, p_amount: 999 })
await expect('editing a bulk-switched Q1 row moves nothing', { cash: 840, bank: 570, card: 0 })
const onAdjust = await rpc('transactions_set_affects_balance', { ...range, p_affects_balance: true, p_wallet_id: bank, p_adjust_balances: true })
check('bulk on for one wallet', onAdjust.data.updated === 2, onAdjust)
await expect('bulk on with adjust applies Bank’s Q1 rows (import 60 in + 70 in)', { cash: 840, bank: 700, card: 0 })
const offAdjust = await rpc('transactions_set_affects_balance', { ...range, p_affects_balance: false, p_wallet_id: bank, p_adjust_balances: true })
check('bulk off with adjust', offAdjust.data.updated === 2, offAdjust)
await expect('bulk off with adjust takes them back out', { cash: 840, bank: 570, card: 0 })

// --- reports still count history rows ---
const totals = await db.query<{ spent: string }>(`select coalesce(sum(amount), 0) as spent from public.transactions where type = 'expense' and status = 'completed' and date >= '2026-01-01' and date < '2026-02-01'`)
check('history rows still in the monthly totals', Number(totals.rows[0].spent) === 120 + 999, totals.rows)

// --- reconcile ---
const rec = await rpc('wallets_reconcile')
const row = (id: string) => rec.data.find((w: { walletId: string }) => w.walletId === id)
const b = await balances()
check('reconcile lists every wallet', !rec.error && rec.data.length === 3, rec)
check('reconcile: Cash stored balance', row(cash).storedBalance === b.cash, row(cash))
// Cash started at 1000. Only the April 10 expense still affects it; the 120 and 30 Q1 expenses were
// marked as history while keeping the balance, so they now sit in the gap (1000 - 150 = 850).
check('reconcile: Cash gap is start balance plus rows marked as history', row(cash).transactionBalance === -10 && row(cash).difference === 850, row(cash))
check('reconcile: Bank gap and history count', row(bank).transactionBalance === 0 && row(bank).difference === 570 && row(bank).nonBalanceTransactions === 2, row(bank))
check('reconcile: Card has no drift', row(card).difference === 0, row(card))
await db.exec(`update public.wallets set balance = balance + 7 where id = '${cash}'`)
const drift = await rpc('wallets_reconcile')
check('reconcile shows drift when a balance moves without a transaction', drift.data.find((w: { walletId: string }) => w.walletId === cash).difference === 857, drift.data)

// --- sync: a queued edit replays on the server through sync_replay exactly once ---
const replayTx = await create({ p_wallet_id: bank, p_amount: 25, p_type: 'expense' })
const before = await balances()
const opId = '22222222-2222-2222-2222-222222222222'
const replayArgs = JSON.stringify({ p_id: replayTx.data.id, p_amount: 40, p_type: 'expense', p_wallet_id: bank, p_affects_balance: true, p_exclude_from_baseline: null })
for (let i = 0; i < 2; i++) await db.query(`select public.sync_replay($1::uuid, 'transactions_update', $2::jsonb, '[]'::jsonb)`, [opId, replayArgs])
await expect('replayed edit applied once (25 -> 40)', { cash: before.cash, bank: before.bank - 15, card: before.card })
const replayFlag = JSON.stringify({ p_id: replayTx.data.id, p_affects_balance: false })
await db.query(`select public.sync_replay(gen_random_uuid(), 'transactions_update', $1::jsonb, '[]'::jsonb)`, [replayFlag])
await expect('replayed flag switch puts the 40 back', { ...before, bank: before.bank + 25 })
const replayBulk = JSON.stringify({ ...range, p_affects_balance: true, p_wallet_id: cash })
const bulkRes = await db.query<{ r: unknown }>(`select public.sync_replay(gen_random_uuid(), 'transactions_set_affects_balance', $1::jsonb, '[]'::jsonb) as r`, [replayBulk])
check('bulk replays through sync_replay', !!bulkRes.rows[0].r, bulkRes.rows)

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
