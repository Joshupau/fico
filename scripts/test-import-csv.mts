// Run: npx tsx scripts/test-import-csv.mts
import { csvHeaders, parseImportCsv } from '../utils/import-csv'
import { detectFormat, dropDuplicates, parseImportFile } from '../utils/import-formats'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

const debitCredit = parseImportCsv('Date,Description,Debit,Credit\n2024-01-05,Coffee,150.00,0.00\n2024-01-06,Salary,0.00,"5,000.00"', [])
check('0.00 in the unused column does not hide the real amount', debitCredit.valid.length === 2 && debitCredit.valid[1].type === 'income' && debitCredit.valid[1].amount === 5000, debitCredit)

const withTime = parseImportCsv('Date,Time,Description,Amount,Indicator\n25/01/2024,10:30,Rent,1200,DBIT\n05/01/2024,9:05,Shop,10,DBIT', [])
check('DD/MM/YYYY with a time column', withTime.valid.length === 2 && withTime.valid[0].date.startsWith('2024-01-25') && withTime.valid[1].date.startsWith('2024-01-05'), withTime)

const amounts = parseImportCsv('Date,Description,Amount,Indicator\n2024-01-01,a,"1,234",DBIT\n2024-01-01,b,"12,50",DBIT\n2024-01-01,c,"1.234,56",DBIT\n2024-01-01,d,"12,500",DBIT', [])
check('thousands vs decimal commas', amounts.valid.map((r) => r.amount).join() === '1234,12.5,1234.56,12500', amounts.valid.map((r) => r.amount))

// Categorization rules fill rows the file leaves without a category; the file's own Category wins.
const rule = { id: 'r1', position: 1, matchField: 'description' as const, matchOp: 'contains' as const, matchValue: 'jollibee', matchType: null, setCategoryId: 'food', setTags: ['eat'], setWalletId: null, enabled: true }
const ruled = parseImportCsv(
  'Date,Description,Amount,Indicator,Category\n2024-01-01,JOLLIBEE QC,200,DBIT,\n2024-01-02,Jollibee,100,DBIT,Gifts\n2024-01-03,Other,50,DBIT,',
  [{ id: 'gifts', name: 'Gifts' }],
  'misc',
  [rule]
)
check(
  'rules categorize imported rows, the file wins, the default fills the rest',
  ruled.valid.map((r) => r.category_id).join() === 'food,gifts,misc' && ruled.valid[0].tags.includes('eat'),
  ruled.valid.map((r) => [r.category_id, r.tags])
)

// ---------- Other formats (E6) ----------
const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240105120000[+8:PHT]<TRNAMT>-150.00<FITID>A1<NAME>STARBUCKS BGC<MEMO>POS purchase
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240115<TRNAMT>25000.00<FITID>A2<NAME>PAYROLL ACME
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
const o = parseImportFile(ofx, 'statement.ofx', [])
check('OFX detected and parsed', o.format === 'ofx' && o.valid.length === 2, o)
check('OFX signs and names', o.valid[0].type === 'expense' && o.valid[0].amount === 150 && o.valid[0].description.includes('STARBUCKS') && o.valid[1].type === 'income' && o.valid[1].date.startsWith('2024-01-1'), o.valid)

const qif = `!Type:Bank
D01/05/2024
T-1,200.50
PMeralco
Lutilities
^
D1/15'24
T5000
PSalary
L[Savings]
^`
const q = parseImportFile(qif, 'export.qif', [{ id: 'util', name: 'Utilities' }])
check('QIF detected and parsed', q.format === 'qif' && q.valid.length === 2, q)
check('QIF amounts, dates and categories', q.valid[0].amount === 1200.5 && q.valid[0].type === 'expense' && q.valid[0].category_id === 'util' && q.valid[1].category_id === null && q.valid[1].type === 'income', q.valid)

const firefly = parseImportCsv('description,amount,date,type,category\nGroceries,-850.25,2024-02-01,Withdrawal,\nRefund,120,2024-02-02,Deposit,\nTo savings,-1000,2024-02-03,Transfer,', [])
check('Firefly III: type column, transfers skipped', firefly.valid.length === 2 && firefly.valid[0].type === 'expense' && firefly.valid[0].amount === 850.25 && firefly.valid[1].type === 'income' && firefly.skipped.length === 1, firefly)

const actual = parseImportCsv('Date,Payee,Notes,Category,Amount\n2024-03-01,Jollibee,,Food,-245.00\n2024-03-02,Boss,March pay,,30000.00', [{ id: 'food', name: 'Food' }])
check('Actual Budget: signed amounts, payee, notes', actual.valid.length === 2 && actual.valid[0].type === 'expense' && actual.valid[0].category_id === 'food' && actual.valid[1].description.includes('March pay'), actual.valid)

const odd = 'Posted On,Details,Value\n2024-04-01,Load,-99\n'
check('unknown headers are listed for mapping', csvHeaders(odd).join() === 'Posted On,Details,Value')
const mapped = parseImportCsv(odd, [], null, [], { date: 'Posted On', description: 'Details', amount: 'Value' })
check('column mapping', mapped.valid.length === 1 && mapped.valid[0].amount === 99 && mapped.valid[0].type === 'expense', mapped)
check('CSV stays CSV', detectFormat('Date,Amount\n', 'x.csv') === 'csv')

// Re-importing the same file adds nothing; a real second identical purchase still imports.
const first = parseImportFile(ofx, 'statement.ofx', []).valid
const existing = first.map((r) => ({ date: r.date, amount: String(r.amount), type: r.type, description: r.description }))
const again = dropDuplicates(parseImportFile(ofx, 'statement.ofx', []).valid, existing)
check('re-import adds nothing', again.fresh.length === 0 && again.duplicates === 2, again)
const twoCoffees = dropDuplicates([first[0], first[0]], [existing[0]])
check('one-to-one matching keeps a real second purchase', twoCoffees.fresh.length === 1 && twoCoffees.duplicates === 1, twoCoffees)

console.log(failures ? failures + ' FAILURES' : 'ALL PASSED')
process.exit(failures ? 1 : 0)
