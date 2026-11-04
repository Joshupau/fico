// End-to-end sync test: a "server" Postgres, a "device" local database, and the real SyncEngine between them.
// Run: npx tsx scripts/test-sync.mts
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOCAL_EXTRAS_STATEMENTS, LOCAL_PRELUDE_STATEMENTS, LOCAL_SCHEMA_STATEMENTS } from '../lib/local/schema.generated'
import { loadCatalog, LocalEngine, type Db } from '../lib/local/engine'
import { recordingBuilder } from '../lib/local/builder'
import { LocalDatabase } from '../lib/local/database'
import { MAX_ATTEMPTS, SyncEngine, syncStatus } from '../lib/local/sync'

// sync.ts reads navigator.onLine to decide whether to try the network.
const setOnline = (on: boolean) => Object.defineProperty(globalThis.navigator, 'onLine', { value: on, configurable: true })
setOnline(true)

const UID = '11111111-1111-1111-1111-111111111111'

// --- the server ---------------------------------------------------------------------------------
const serverDb = new PGlite()
for (const s of [...LOCAL_PRELUDE_STATEMENTS, ...LOCAL_SCHEMA_STATEMENTS, ...LOCAL_EXTRAS_STATEMENTS]) await serverDb.exec(s)
await serverDb.exec(`set session_replication_role = replica; insert into auth.users (id, email) values ('${UID}', 'a@b.c'); insert into public.profiles (id, username) values ('${UID}', 'tester'); set session_replication_role = origin`)
await serverDb.exec(`select set_config('app.user_id', '${UID}', false)`)
const server = new LocalEngine(serverDb as unknown as Db, await loadCatalog(serverDb as unknown as Db))
let offline = false
const remote = {
  from: (t: string) => recordingBuilder([], (c) => (offline ? Promise.reject(new Error('Failed to fetch')) : server.execute('table', t, c))),
  rpc: (n: string, args: object = {}) => recordingBuilder([['rpc-args', [args]]], (c) => (offline ? Promise.reject(new Error('Failed to fetch')) : server.execute('rpc', n, c))),
  auth: { refreshSession: async () => ({}) },
} as unknown as SupabaseClient
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S = (t: string): any => remote.from(t)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR = (n: string, a: object = {}): any => remote.rpc(n, a)

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const snapshot = async (db: PGlite) =>
  JSON.stringify({
    wallets: (await db.query('select id, name, balance from public.wallets order by id')).rows,
    transactions: (await db.query('select id, type, amount, wallet_id, status from public.transactions order by id')).rows,
    bills: (await db.query('select id, name, payment_status, paid_amount from public.bills order by id')).rows,
    categories: (await db.query('select id, name from public.categories where owner_id is not null order by id')).rows,
  })

// Data that exists before the device ever syncs.
const w = await S('wallets').insert({ name: 'Cash', type: 'cash', balance: 1000 }).select().single()
await SR('transactions_create', { p_wallet_id: w.data.id, p_amount: 100, p_type: 'expense', p_description: 'before', p_date: new Date().toISOString() })

// --- the device ---------------------------------------------------------------------------------
let queuedSignals = 0
const local = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite(), onQueued: () => queuedSignals++ })
const sync = new SyncEngine(local, remote)
await sync.hydrate()
check('hydrate copies server data', (await snapshot(local.db)) === (await snapshot(serverDb)), { local: await snapshot(local.db), server: await snapshot(serverDb) })

// Offline work.
offline = true
setOnline(false)
const L = (t: string) => recordingBuilder([], (c) => local.engine.execute('table', t, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const LR = (n: string, a: object = {}) => recordingBuilder([['rpc-args', [a]]], (c) => local.engine.execute('rpc', n, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
const wal2 = await L('wallets').insert({ name: 'Bank', type: 'bank', balance: 200 }).select().single()
const cat = await LR('categories_create', { p_name: 'Food', p_type: 'expense' })
await LR('transactions_create', { p_wallet_id: wal2.data.id, p_amount: 30, p_type: 'expense', p_category_id: cat.data.id, p_description: 'lunch', p_date: new Date().toISOString() })
const bill = await LR('bills_create', { p_name: 'Salary', p_amount: 5000, p_due_date: new Date().toISOString(), p_is_recurring: true, p_type: 'income', p_recurring_frequency: 'biweekly', p_wallet_id: wal2.data.id })
await LR('bills_mark_paid', { p_id: bill.data.id })
check('changes queued while offline', (await local.pendingCount()) === 5 && queuedSignals === 5, { pending: await local.pendingCount(), queuedSignals })
await sync.request()
check('offline: nothing pushed, queue kept', (await local.pendingCount()) === 5)

// Back online.
offline = false
setOnline(true)
await sync.request()
check('queue drained', (await local.pendingCount()) === 0, await local.pendingCount())
const a = await snapshot(local.db)
const b = await snapshot(serverDb)
check('device and server converge with identical ids', a === b, { a, b })
const balance = (await serverDb.query<{ balance: number }>(`select balance::float as balance from public.wallets where id = $1`, [wal2.data.id])).rows[0].balance
check('server applied the same rules (200 - 30 + 5000 = 5170)', balance === 5170, balance)

// Another device changes things.
await S('wallets').update({ name: 'Cash (renamed)' }).eq('id', w.data.id)
await SR('transactions_create', { p_wallet_id: w.data.id, p_amount: 10, p_type: 'expense', p_description: 'from phone', p_date: new Date().toISOString() })
await sync.request()
check('pull brings other-device changes', (await snapshot(local.db)) === (await snapshot(serverDb)))

// Deleted on the server.
const victim = (await serverDb.query<{ id: string }>(`select id from public.transactions where description = 'from phone'`)).rows[0].id
await SR('transactions_delete', { p_id: victim })
await sync.request()
check('pull removes rows deleted elsewhere', (await snapshot(local.db)) === (await snapshot(serverDb)))

// Budgets carry generated columns (remaining, percentage_spent) that the download must not write.
await SR('budgets_create', { p_name: 'Needs', p_amount: 1000, p_period: 'monthly', p_start_date: new Date().toISOString(), p_category_ids: [] })
await sync.request()
const budgetsHere = (await local.db.query<{ n: number }>(`select count(*)::int as n from public.budgets`)).rows[0].n
check('pull brings budgets', budgetsHere === 1 && (await snapshot(local.db)) === (await snapshot(serverDb)), { budgetsHere, failures: syncStatus.get().failures })

// A change the server rejects: the wallet was archived on another device while this one was offline.
offline = true
setOnline(false)
await LR('transactions_create', { p_wallet_id: wal2.data.id, p_amount: 100, p_type: 'expense', p_description: 'will be rejected', p_date: new Date().toISOString() })
offline = false
setOnline(true)
await serverDb.query(`update public.wallets set status = 'archived' where id = $1`, [wal2.data.id])
await sync.request()
const st = syncStatus.get()
check('rejected change is reported', st.failures.length === 1 && /wallet|inactive|not found/i.test(st.failures[0].message), st.failures)
check('after a rejection the device matches the server again', (await snapshot(local.db)) === (await snapshot(serverDb)))
check('queue empty after failure', (await local.pendingCount()) === 0)

// Replaying the same op twice is harmless.
const opId = crypto.randomUUID()
await SR('sync_replay', { p_op_id: opId, p_name: 'bills_summary', p_args: {}, p_ids: [] })
const again = await SR('sync_replay', { p_op_id: opId, p_name: 'bills_summary', p_args: {}, p_ids: [] })
check('duplicate replay ignored', again.data?.duplicate === true, again)

// A second device whose first download is cut short, against a server that lacks a column the device has.
{
  let failOn: string | null = 'transactions'
  const strip = (rows: unknown) =>
    Array.isArray(rows) ? rows.map(({ total_interest_earned: _drop, ...r }: Record<string, unknown>) => r) : rows
  const flaky = {
    ...remote,
    from: (t: string) =>
      recordingBuilder([], async (c) => {
        if (t === failOn && c.some(([m]) => m === 'in')) {
          failOn = null
          return Promise.reject(new Error('Failed to fetch'))
        }
        const res = await server.execute('table', t, c)
        return t === 'wallets' ? { ...res, data: strip(res.data) } : res
      }),
  } as unknown as SupabaseClient
  const local2 = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
  const sync2 = new SyncEngine(local2, flaky)
  const cut = await sync2.hydrate().then(() => false, () => true)
  const keptWallets = (await local2.db.query<{ n: number }>(`select count(*)::int as n from public.wallets`)).rows[0].n
  check('interrupted first download keeps the tables it finished', cut && keptWallets > 0 && (await local2.meta('last_pull_at')) === null, { cut, keptWallets })
  await sync2.hydrate()
  check('next attempt completes it', (await snapshot(local2.db)) === (await snapshot(serverDb)) && (await local2.meta('last_pull_at')) !== null)
  const interest = (await local2.db.query<{ v: number | null }>(`select total_interest_earned::float as v from public.wallets`)).rows
  check('columns the server did not send take their local default', interest.length > 0 && interest.every((r) => r.v === 0), interest)
  sync2.stop()
}

// A server whose migrations are behind the app: it has no planned_items table yet.
{
  let lacksPlanned = true
  let walletsDown = false
  const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.planned_items' in the schema cache", details: '', hint: '' }, count: null, status: 404, statusText: 'Not Found' }
  const broken = { data: null, error: { code: 'XX000', message: 'wallets: internal error', details: '', hint: '' }, count: null, status: 500, statusText: 'Internal Server Error' }
  const behind = {
    ...remote,
    from: (t: string) =>
      recordingBuilder([], (c) =>
        t === 'planned_items' && lacksPlanned ? Promise.resolve(missing) : t === 'wallets' && walletsDown ? Promise.resolve(broken) : server.execute('table', t, c)
      ),
  } as unknown as SupabaseClient
  syncStatus.dismissFailures()
  const local3 = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
  const sync3 = new SyncEngine(local3, behind)
  const done = await sync3.hydrate().then(() => true, (e) => e)
  check('first download finishes when the server lacks a table', done === true && (await local3.meta('last_pull_at')) !== null, String(done))
  check('the other tables are copied', (await snapshot(local3.db)) === (await snapshot(serverDb)))

  const L3 = (t: string) => recordingBuilder([], (c) => local3.engine.execute('table', t, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const today = new Date().toISOString().slice(0, 10)
  const planned = await L3('planned_items').insert({ name: 'Bonus', type: 'income', amount_low: 100, amount_high: 200, date: today }).select().single()
  await L3('planned_items').update({ amount_high: 300 }).eq('id', planned.data.id)
  const wal3 = await L3('wallets').insert({ name: 'Savings', type: 'bank', balance: 50 }).select().single()
  await sync3.request()
  const onServer = (await serverDb.query(`select 1 from public.wallets where id = $1`, [wal3.data.id])).rows.length
  check('other changes still upload past one for a missing table', onServer === 1 && (await local3.pendingCount()) === 2, { onServer, pending: await local3.pendingCount() })
  check('the held change stays on the device', (await local3.db.query(`select 1 from public.planned_items where id = $1`, [planned.data.id])).rows.length === 1)
  check('a held change shows as stalled, not as a failure', syncStatus.get().stalled && syncStatus.get().failures.length === 0, syncStatus.get())

  await S('categories').insert({ name: 'From web', type: 'expense' })
  walletsDown = true
  await sync3.request()
  const gotCategory = (await local3.db.query(`select 1 from public.categories where name = 'From web'`)).rows.length
  check('one table failing to download does not stop the others', gotCategory === 1, gotCategory)
  check('the failing table is reported', /wallets/.test(syncStatus.get().error ?? ''), syncStatus.get().error)
  walletsDown = false

  // The server is migrated: the held changes go up, in order.
  lacksPlanned = false
  await sync3.request()
  const row = (await serverDb.query<{ amount_high: number }>(`select amount_high::float as amount_high from public.planned_items where id = $1`, [planned.data.id])).rows[0]
  check('held changes upload once the server has the table', row?.amount_high === 300 && (await local3.pendingCount()) === 0, { row, pending: await local3.pendingCount() })
  check('sync is no longer stalled', !syncStatus.get().stalled && syncStatus.get().error === null, syncStatus.get())
  sync3.stop()
}

// A table that keeps failing to download (not a lost connection) must not hold the first download
// back: the app would start it over on every launch and never open from the device.
{
  let walletsDown = true
  const broken = { data: null, error: { code: 'XX000', message: 'wallets: internal error', details: '', hint: '' }, count: null, status: 500, statusText: 'Internal Server Error' }
  const flaky = {
    ...remote,
    from: (t: string) => recordingBuilder([], (c) => (t === 'wallets' && walletsDown ? Promise.resolve(broken) : server.execute('table', t, c))),
  } as unknown as SupabaseClient
  const local4 = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
  const sync4 = new SyncEngine(local4, flaky)
  const done = await sync4.hydrate().then(() => true, (e) => e)
  check('first download finishes when one table keeps failing', done === true && (await local4.meta('last_pull_at')) !== null, String(done))
  walletsDown = false
  await sync4.request()
  check('the failed table comes down on the next sync', (await snapshot(local4.db)) === (await snapshot(serverDb)))
  sync4.stop()
}

// Rows that don't fit the device copy, or a server error that mentions a timeout, are one table's
// problem: the first download still finishes and later syncs still bring the other tables down.
{
  let badWallets = true
  const timeout = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout', details: '', hint: '' }, count: null, status: 500, statusText: 'Internal Server Error' }
  const odd = {
    ...remote,
    from: (t: string) =>
      recordingBuilder([], async (c) => {
        if (t === 'bills' && badWallets) return timeout
        const res = await server.execute('table', t, c)
        if (t === 'wallets' && badWallets && c.some(([m]) => m === 'in')) return { ...res, data: (res.data as Record<string, unknown>[]).map((r) => ({ ...r, name: null })) }
        return res
      }),
  } as unknown as SupabaseClient
  const local6 = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
  const sync6 = new SyncEngine(local6, odd)
  const done = await sync6.hydrate().then(() => true, (e) => e)
  check('first download finishes past rows that do not fit and a server timeout', done === true && (await local6.meta('last_pull_at')) !== null, String(done))
  await S('categories').insert({ name: 'Later', type: 'expense' })
  await sync6.request()
  check('later syncs still apply the other tables', (await local6.db.query(`select 1 from public.categories where name = 'Later'`)).rows.length === 1)
  badWallets = false
  await sync6.request()
  check('the bad table syncs once its rows fit', (await snapshot(local6.db)) === (await snapshot(serverDb)))
  sync6.stop()
}

// An app update with a new schema: the old copy's data moves into the new one, so the app opens from
// it without downloading again, and the next sync fetches every row once.
{
  const oldPg = new PGlite()
  const before = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => oldPg })
  await new SyncEngine(before, remote).hydrate()
  // A change the update's migration made on the server without touching updated_at.
  await serverDb.exec(`set session_replication_role = replica; update public.wallets set name = name || ' (renamed)'; set session_replication_role = origin`)

  const newPg = new PGlite()
  const after = await LocalDatabase.open({
    userId: UID,
    email: 'a@b.c',
    username: 'tester',
    factory: async (dir) => (dir === 'old-copy' ? oldPg : newPg),
    legacy: { list: async () => ['old-copy'], remove: async () => {} },
  })
  const wallets = (await after.db.query<{ n: number }>(`select count(*)::int as n from public.wallets`)).rows[0].n
  check('an update carries the device copy across', wallets > 0 && (await after.meta('last_pull_at')) !== null && (await after.meta('refresh_all')) === true, { wallets })
  const sync5 = new SyncEngine(after, remote)
  await sync5.request()
  check('the next sync refreshes every row once', (await snapshot(after.db)) === (await snapshot(serverDb)) && (await after.meta('refresh_all')) === false, {
    a: await snapshot(after.db),
    b: await snapshot(serverDb),
  })
  sync5.stop()
}

// --- incremental pull, backoff and set-aside changes --------------------------------------------
{
  // Records every request the device makes, so a quiet sync can be shown to be small.
  const log: Array<{ table: string; calls: string[] }> = []
  let walletsDown = false
  let replayError: { code: string; message: string; status: number } | null = null
  let refreshes = 0
  const broken = { data: null, error: { code: 'XX000', message: 'wallets: internal error', details: '', hint: '' }, count: null, status: 500, statusText: 'Internal Server Error' }
  const watched = {
    from: (t: string) =>
      recordingBuilder([], (c) => {
        log.push({ table: t, calls: c.map(([m]) => m) })
        return t === 'wallets' && walletsDown ? Promise.resolve(broken) : server.execute('table', t, c)
      }),
    rpc: (n: string, args: object = {}) =>
      recordingBuilder([['rpc-args', [args]]], (c) => {
        const target = (args as { p_name?: string }).p_name
        if (replayError && (target === 'transactions_create' || replayError.code === 'PGRST202' || replayError.code === 'PGRST301')) {
          const { code, message, status } = replayError
          return Promise.resolve({ data: null, error: { code, message, details: '', hint: '' }, count: null, status, statusText: 'Error' })
        }
        return server.execute('rpc', n, c)
      }),
    auth: { refreshSession: async () => (refreshes++, {}) },
  } as unknown as SupabaseClient
  syncStatus.dismissFailures()
  const local7 = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => new PGlite() })
  const sync7 = new SyncEngine(local7, watched)
  await sync7.hydrate()
  const L7 = (t: string) => recordingBuilder([], (c) => local7.engine.execute('table', t, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const LR7 = (n: string, a: object = {}) => recordingBuilder([['rpc-args', [a]]], (c) => local7.engine.execute('rpc', n, c)) as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // A sync with nothing new: per table, one incremental read plus a row count. No id lists, no fetch by id.
  log.length = 0
  await sync7.request(true)
  const perTable = new Map<string, number>()
  for (const r of log) perTable.set(r.table, (perTable.get(r.table) ?? 0) + 1)
  check('a quiet sync makes at most two small requests per table', [...perTable.values()].every((n) => n <= 2) && !log.some((r) => r.calls.includes('in')), Object.fromEntries(perTable))
  check('a quiet sync reads only rows changed since the last pull', log.filter((r) => r.calls.includes('gt')).length >= 10, log.map((r) => `${r.table}:${r.calls.join('.')}`))

  // Changes elsewhere still arrive, and a delete is caught by the row count.
  await S('categories').insert({ name: 'Incremental', type: 'expense' })
  await sync7.request(true)
  check('incremental pull brings new rows', (await local7.db.query(`select 1 from public.categories where name = 'Incremental'`)).rows.length === 1)
  await serverDb.query(`delete from public.categories where name = 'Incremental'`)
  await sync7.request(true)
  check('incremental pull notices a delete', (await local7.db.query(`select 1 from public.categories where name = 'Incremental'`)).rows.length === 0)

  // A row deleted and another added with an old stamp in the same window: the count still matches and
  // the new row is older than the mark, so the incremental pull misses both. The full check finds them.
  const gone = (await serverDb.query<{ id: string }>(`select id from public.categories where owner_id is not null limit 1`)).rows[0].id
  await serverDb.exec(`set session_replication_role = replica;
    delete from public.categories where id = '${gone}';
    insert into public.categories (owner_id, name, type, updated_at) values ('${UID}', 'Backdated', 'expense', now() - interval '1 day');
    set session_replication_role = origin`)
  await sync7.request(true)
  const inSync = async () =>
    (await local7.db.query(`select 1 from public.categories where name = 'Backdated'`)).rows.length === 1 &&
    (await local7.db.query(`select 1 from public.categories where id = $1`, [gone])).rows.length === 0
  const missedFirst = !(await inSync())
  await sync7.fullCheck()
  check('the full check catches what the incremental pull missed', missedFirst && (await inSync()) && (await local7.meta('full_check_at')) !== null, { missedFirst })

  // A change the server keeps failing on: retried with backoff, then set aside so the next one goes up.
  const wal7 = (await local7.db.query<{ id: string }>(`select id from public.wallets limit 1`)).rows[0].id
  replayError = { code: 'XX000', message: 'boom', status: 500 }
  await LR7('transactions_create', { p_wallet_id: wal7, p_amount: 7, p_type: 'expense', p_description: 'always fails', p_date: new Date().toISOString() })
  await L7('categories').insert({ name: 'After the stuck one', type: 'expense' })
  await sync7.request(true)
  const attempts1 = (await local7.db.query<{ attempts: number }>(`select attempts from public._sync_outbox order by seq limit 1`)).rows[0]?.attempts
  check('a failing change is tried again later, not dropped', attempts1 === 1 && (await local7.pendingCount()) === 2 && syncStatus.get().retryAt !== null, { attempts1, retryAt: syncStatus.get().retryAt })
  log.length = 0
  await sync7.request()
  check('during the backoff nothing is sent', log.length === 0, log.length)
  for (let i = 1; i < MAX_ATTEMPTS; i++) await sync7.request(true)
  const after7 = await sync7.details()
  check('after too many tries it is set aside and the rest sync', after7.dead === 1 && after7.pending === 0 && after7.changes[0]?.status === 'dead' && after7.changes[0]?.lastError === 'boom', after7)
  check('the change after it reached the server', (await serverDb.query(`select 1 from public.categories where name = 'After the stuck one'`)).rows.length === 1)
  check('the user is told once', syncStatus.get().failures.length === 1 && syncStatus.get().dead === 1, syncStatus.get().failures)
  check('a set-aside change is kept for sign-out', (await local7.unsentCount()) === 1)

  // Retry once the server is fixed.
  replayError = null
  await sync7.retry()
  check('Retry sends a set-aside change', (await sync7.details()).dead === 0 && (await serverDb.query(`select 1 from public.transactions where description = 'always fails'`)).rows.length === 1)

  // Discard.
  replayError = { code: '23514', message: 'refused', status: 400 }
  await LR7('transactions_create', { p_wallet_id: wal7, p_amount: 8, p_type: 'expense', p_description: 'refused', p_date: new Date().toISOString() })
  await sync7.request(true)
  const refused = await sync7.details()
  check('a refused change is set aside at once, not dropped', refused.dead === 1 && refused.changes[0]?.attempts === 1, refused)
  await sync7.discard(refused.changes[0].seq)
  check('Discard removes it', (await sync7.details()).dead === 0 && (await local7.unsentCount()) === 0)
  replayError = null

  // sync_replay missing on the server: hold everything, say so, don't count tries.
  replayError = { code: 'PGRST202', message: 'Could not find the function public.sync_replay', status: 404 }
  await LR7('transactions_create', { p_wallet_id: wal7, p_amount: 9, p_type: 'expense', p_description: 'needs migration', p_date: new Date().toISOString() })
  for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await sync7.request(true)
  const old = await sync7.details()
  check('a server without sync_replay holds the queue', old.pending === 1 && old.dead === 0 && old.serverNeedsUpdate && old.changes[0].attempts === 0, old)

  // An expired session: refresh and wait, never count it against the change.
  replayError = { code: 'PGRST301', message: 'JWT expired', status: 401 }
  for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await sync7.request(true)
  const jwt = await sync7.details()
  check('an expired session never sets a change aside', jwt.pending === 1 && jwt.dead === 0 && jwt.changes[0].attempts === 0 && refreshes > 0, { jwt, refreshes })
  replayError = null
  await sync7.request(true)
  check('it goes up once the session is fine', (await local7.pendingCount()) === 0 && !syncStatus.get().serverNeedsUpdate)

  // Going offline and back: the reconnect sync ignores any backoff.
  setOnline(false)
  await LR7('transactions_create', { p_wallet_id: wal7, p_amount: 3, p_type: 'expense', p_description: 'offline then online', p_date: new Date().toISOString() })
  await sync7.request(true)
  const heldOffline = await local7.pendingCount()
  setOnline(true)
  await sync7.request(true)
  check('offline changes wait without counting tries, then go up', heldOffline === 1 && (await local7.pendingCount()) === 0)

  // Per-table refresh: one table failing doesn't make the others fetch every row again.
  await local7.setMeta('refresh_all', true)
  walletsDown = true
  log.length = 0
  await sync7.request(true)
  const fetchedById1 = new Set(log.filter((r) => r.calls.includes('in')).map((r) => r.table))
  log.length = 0
  await sync7.request(true)
  const fetchedById2 = new Set(log.filter((r) => r.calls.includes('in')).map((r) => r.table))
  const refreshing = await local7.meta<string[]>('refresh_tables')
  check('a refresh downloads each table once, and only the failing one is left', fetchedById1.has('categories') && !fetchedById2.has('categories') && JSON.stringify(refreshing) === '["wallets"]', { fetchedById1: [...fetchedById1], fetchedById2: [...fetchedById2], refreshing })
  walletsDown = false
  await sync7.request(true)
  check('the failing table refreshes once it works', JSON.stringify(await local7.meta('refresh_tables')) === '[]')
  sync7.stop()

  // Set-aside changes survive an app update that rebuilds the device copy.
  const oldPg = new PGlite()
  const before = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async () => oldPg })
  await before.db.query(`insert into public._sync_outbox (kind, payload, status, attempts, last_error) values ('rpc', '{"name":"x"}', 'dead', 8, 'boom')`)
  const newPg = new PGlite()
  const after = await LocalDatabase.open({ userId: UID, email: 'a@b.c', username: 'tester', factory: async (dir) => (dir === 'old-copy' ? oldPg : newPg), legacy: { list: async () => ['old-copy'], remove: async () => {} } })
  const carried = (await after.db.query<{ status: string; attempts: number }>(`select status, attempts from public._sync_outbox`)).rows
  check('set-aside changes carry across an update', carried.length === 1 && carried[0].status === 'dead' && carried[0].attempts === 8, carried)
}

sync.stop()
console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
