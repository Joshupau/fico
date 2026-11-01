// Category edit / archive / delete (migration 0060) against the on-device schema.
import { bootLocalDb } from './test-local-schema.mjs'

const db = await bootLocalDb()
const uid = '11111111-1111-1111-1111-111111111111'
let failed = 0
const check = (label, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) failed++ }
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
const val = async (sql, args = []) => Object.values((await one(sql, args)) ?? {})[0]

await db.query(`select set_config('app.user_id', $1, false)`, [uid])
const other = '22222222-2222-2222-2222-222222222222'
for (const id of [uid, other]) {
  await db.query(`insert into auth.users (id) values ($1)`, [id])
  await db.query(`insert into public.profiles (id, username) values ($1, $2) on conflict (id) do nothing`, [id, `user-${id.slice(0, 4)}`])
}
const defaults = await val(`select count(*)::int from categories where owner_id is null`)
const food = await val(`select id from categories where owner_id is null and name = 'Food & Dining'`)
const groceries = await val(`select id from categories where owner_id is null and name = 'Groceries'`)
const wallet = await val(`insert into wallets (owner_id, name) values ($1, 'Cash') returning id`, [uid])
for (let i = 0; i < 3; i++) {
  await db.query(`insert into transactions (owner_id, wallet_id, category_id, type, amount, date) values ($1, $2, $3, 'expense', 100, now())`, [uid, wallet, food])
}
await db.query(`insert into transactions (owner_id, wallet_id, category_id, type, amount, date) values ($1, $2, $3, 'expense', 50, now())`, [uid, wallet, groceries])
await db.query(`insert into budgets (owner_id, name, amount, period, start_date, end_date, category_id, category_ids) values ($1, 'Food', 1000, 'monthly', now(), now() + interval '30 days', $2, array[$2]::uuid[])`, [uid, food])
await db.query(`insert into budgets (owner_id, name, amount, period, start_date, end_date, category_id, category_ids) values ($1, 'Mixed', 1000, 'monthly', now(), now() + interval '30 days', $2, array[$2, $3]::uuid[])`, [uid, food, groceries])
await db.query(`update profiles set baseline_excluded_category_ids = array[$1]::uuid[] where id = $2`, [food, uid])

// Edit a default: becomes the user's own copy, everything follows it.
const edited = await one(`select * from categories_update($1, 'Eating out', null, '#000000')`, [food])
// What the device logs for the queued edit: the new rows' ids, in insert order.
const deviceIds = (await db.query(`select id from categories where owner_id = $1 order by copied_from`, [uid])).rows.map((r) => r.id)
check(`defaults were copied (${defaults})`, (await val(`select count(*)::int from categories where owner_id = $1`, [uid])) === defaults)
check('profile marked as owning categories', await val(`select owns_categories from profiles where id = $1`, [uid]))
check('edited copy has the new name and color', edited.name === 'Eating out' && edited.color === '#000000' && edited.owner_id === uid)
check('default row itself untouched', (await val(`select name from categories where id = $1`, [food])) === 'Food & Dining')
check('transactions moved to the copy', (await val(`select count(*)::int from transactions where category_id = $1`, [edited.id])) === 3)
check('no transaction still on a default', (await val(`select count(*)::int from transactions t join categories c on c.id = t.category_id where c.owner_id is null`)) === 0)
check('budget arrays moved', (await val(`select count(*)::int from budgets where $1 = any(category_ids)`, [edited.id])) === 2)
check('baseline exclusion moved', (await val(`select $1 = any(baseline_excluded_category_ids) from profiles where id = $2`, [edited.id, uid])))
check('second edit does not copy again', (await one(`select * from categories_update($1, 'Eating out 2')`, [food])).id === edited.id &&
  (await val(`select count(*)::int from categories where owner_id = $1`, [uid])) === defaults)

// Duplicate names are refused.
let dup = null
try { await db.query(`select categories_update($1, 'groceries')`, [edited.id]) } catch (e) { dup = e.message }
check('rename to an existing name refused', /already exists/.test(dup ?? ''))

// Archive / unarchive keeps history.
const myGroceries = await val(`select id from categories where owner_id = $1 and copied_from = $2`, [uid, groceries])
await db.query(`select categories_archive($1)`, [myGroceries])
check('archived', (await val(`select status from categories where id = $1`, [myGroceries])) === 'archived')
check('archived category keeps its transaction', (await val(`select count(*)::int from transactions where category_id = $1`, [myGroceries])) === 1)
await db.query(`select categories_unarchive($1)`, [myGroceries])
check('unarchived', (await val(`select status from categories where id = $1`, [myGroceries])) === 'active')

// Delete with a replacement.
const moved = await val(`select categories_delete($1, $2)`, [edited.id, myGroceries])
check('delete reports moved transactions', moved.movedTransactions === 3)
check('category gone', (await val(`select count(*)::int from categories where id = $1`, [edited.id])) === 0)
check('transactions now on replacement', (await val(`select count(*)::int from transactions where category_id = $1`, [myGroceries])) === 4)
check('single-category budget moved to replacement', (await one(`select * from budgets where name = 'Food'`)).category_ids[0] === myGroceries)
check('mixed budget deduplicated', (await one(`select * from budgets where name = 'Mixed'`)).category_ids.length === 1)

// Delete without a replacement: uncategorized, empty budgets archived.
await db.query(`select categories_delete($1)`, [myGroceries])
check('transactions uncategorized', (await val(`select count(*)::int from transactions where category_id is null`)) === 4)
check('budgets left empty are archived', (await val(`select count(*)::int from budgets where status = 'archived'`)) === 2)

// Type mismatch refused.
const salary = await val(`select id from categories where owner_id = $1 and name = 'Salary'`, [uid])
const rent = await val(`select id from categories where owner_id = $1 and name = 'Rent'`, [uid])
let mismatch = null
try { await db.query(`select categories_delete($1, $2)`, [rent, salary]) } catch (e) { mismatch = e.message }
check('replacement of another type refused', /same type/.test(mismatch ?? ''))

// Another user's category is out of reach.
const theirs = await val(`insert into categories (owner_id, name, type) values ($1, 'Theirs', 'expense') returning id`, [other])
let denied = null
try { await db.query(`select categories_delete($1)`, [theirs]) } catch (e) { denied = e.message }
check("someone else's category can't be deleted", /not found/.test(denied ?? ''))

// Offline: the device's copies get the same ids on the server when the queued edit is replayed.
const server = await bootLocalDb()
await server.query(`select set_config('app.user_id', $1, false)`, [uid])
// Same shared defaults as the device (the device downloads them from the server).
await server.query(`delete from categories where owner_id is null`)
for (const row of (await db.query(`select id, name, type, icon, color from categories where owner_id is null`)).rows) {
  await server.query(`insert into categories (id, owner_id, name, type, icon, color, is_default) values ($1, null, $2, $3, $4, $5, true)`, [row.id, row.name, row.type, row.icon, row.color])
}
await server.query(`insert into auth.users (id) values ($1)`, [uid])
await server.query(`insert into public.profiles (id, username) values ($1, 'tester') on conflict (id) do nothing`, [uid])
const salaryDefault = await val(`select copied_from from categories where id = $1`, [salary])
await server.query(`select sync_replay(gen_random_uuid(), 'categories_update', $1::jsonb, $2::jsonb)`, [
  JSON.stringify({ p_id: salaryDefault, p_name: 'Pay' }),
  JSON.stringify(deviceIds),
])
const serverIds = new Set((await server.query(`select id from categories where owner_id = $1`, [uid])).rows.map((r) => r.id))
check('replayed copies keep the device ids', deviceIds.every((id) => serverIds.has(id)))
check('replayed edit landed on the same copy', (await server.query(`select name from categories where id = $1`, [salary])).rows[0]?.name === 'Pay')

console.log(failed ? `${failed} FAILED` : 'ALL PASSED')
process.exit(failed ? 1 : 0)
