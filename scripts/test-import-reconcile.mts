// Run: npx tsx scripts/test-import-reconcile.mts
// The reconcile step on top of the CSV importer: findings map onto import rows by file line.
import { parseImportCsv } from '../utils/import-csv'
import { applyDecisions, applyFixesToImportRows, checkStatement, statusLabel } from '../utils/import-reconcile'
// Named import from the module file: the .mts test runs as ESM and cannot see `export *` re-exports from the CJS-compiled index.
import { reconcile } from '../utils/ledgerlens/reconcile'
import { withImportKeys } from '../utils/import-key'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// Invented statement. Opening 10,000.00.
const CLEAN = `Date,Description,Debit,Credit,Balance
2026-09-01,COFFEE SHOP,150.00,,"9,850.00"
2026-09-02,PAYROLL CREDIT,,"5,000.00","14,850.00"
2026-09-03,RENT PAYMENT,"4,500.00",,"10,350.00"
2026-09-04,GROCERY SUPERMARKET,"1,275.50",,"9,074.50"
2026-09-05,REFUND,,300.00,"9,374.50"
`
const DROPPED = CLEAN.split('\n').filter((_, i) => i !== 3).join('\n') // rent row gone
const FLIPPED = CLEAN.replace('2026-09-05,REFUND,,300.00,', '2026-09-05,REFUND,300.00,,')

const clean = checkStatement(CLEAN, 'PHP')
check('clean statement is balanced', clean?.report.status === 'balanced', clean?.report)
check('status label reads plainly', clean ? statusLabel(clean.report).title === 'The statement adds up' : false)

const dropped = checkStatement(DROPPED, 'PHP')
check('dropped row is found at the right line', dropped?.report.findings[0]?.kind === 'missing_row' && dropped.report.findings[0].lines[0] === 4, dropped?.report.findings)

// Accepting the fix changes the import rows; categories from the importer are kept.
const rows = parseImportCsv(DROPPED, [{ id: 'rent', name: 'Rent' }], 'misc')
check('import rows carry their file line', rows.valid.map((r) => r.line).join() === '2,3,4,5')
const fixed = applyFixesToImportRows(rows.valid, [dropped!.report.findings[0]!.fix], 'PHP')
check('accepted fix inserts the missing row before line 4', fixed.length === 5 && fixed[2]?.amount === 4500 && fixed[2]?.type === 'expense' && fixed[2]?.tags.includes('reconciled'), fixed)
check('other rows keep the importer\'s category', fixed.every((r, i) => i === 2 || r.category_id === 'misc'))

// Skipping changes nothing.
check('no fixes means identical rows', JSON.stringify(applyFixesToImportRows(rows.valid, [], 'PHP')) === JSON.stringify(rows.valid))

// A flipped row: accept the flip, the statement balances, the import row changes type.
const flipped = checkStatement(FLIPPED, 'PHP')!
const flip = flipped.report.findings[0]!.fix
const after = applyDecisions(flipped.statement, [{ fix: flip, approvedBy: 'test' }], '2026-11-12T00:00:00.000Z')
check('applied flip re-balances', reconcile(after.statement).status === 'balanced')
check('audit names the approver', after.audit[0]?.approvedBy === 'test' && after.audit[0]?.before?.direction === 'debit' && after.audit[0]?.after?.direction === 'credit')
const flippedRows = applyFixesToImportRows(parseImportCsv(FLIPPED, []).valid, [flip], 'PHP')
check('import row type flips to income', flippedRows[4]?.type === 'income')

// Totals only, with the balances typed by the user in major units.
const noBalance = CLEAN.split('\n').map((l, i) => (i === 0 ? 'Date,Description,Debit,Credit' : l.replace(/,("[^"]*"|[^,]*)$/, ''))).join('\n')
const totals = checkStatement(noBalance, 'PHP', { opening: '10,000.00', closing: '9,374.50' })
check('typed balances enable the totals check', totals?.report.mode === 'totals_only' && totals.report.status === 'balanced', totals?.report)
const unverifiable = checkStatement(noBalance, 'PHP')
check('without balances it says so', unverifiable?.report.status === 'unverifiable')

// Files that are not statements do not block the import.
check('non-statement CSV returns null', checkStatement('Name,Note\na,b\n', 'PHP') === null)

// Import keys: same file -> same keys; identical rows in one file -> distinct keys; order-independent of line numbers.
const keyedA = await withImportKeys(parseImportCsv(CLEAN, []).valid)
const keyedB = await withImportKeys(parseImportCsv(CLEAN, []).valid)
check('re-importing the same file gives the same keys', keyedA.map((r) => r.import_key).join() === keyedB.map((r) => r.import_key).join())
check('keys are 64 hex chars', keyedA.every((r) => /^[0-9a-f]{64}$/.test(r.import_key)))
const twice = CLEAN + '2026-09-01,COFFEE SHOP,150.00,,"9,224.50"\n'
const keyedTwice = await withImportKeys(parseImportCsv(twice, []).valid)
check('two identical purchases keep distinct keys', keyedTwice[0]!.import_key !== keyedTwice[5]!.import_key && new Set(keyedTwice.map((r) => r.import_key)).size === 6)
const shifted = await withImportKeys(parseImportCsv('Date,Description,Debit,Credit\n\n' + CLEAN.split('\n').slice(1).join('\n'), []).valid)
check('keys do not depend on line numbers', shifted.map((r) => r.import_key).join() === keyedA.map((r) => r.import_key).join())

console.log(failures ? failures + ' FAILURES' : 'ALL PASSED')
process.exit(failures ? 1 : 0)
