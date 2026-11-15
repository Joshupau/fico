// Run: npx tsx scripts/test-quickadd-hybrid.mts
// The rules + tagger hybrid as Fico calls it. Messages here are new, not from either test set.
import { parseQuickAdd } from '../utils/quickadd-hybrid'
import { parseTransactionText } from '../utils/transaction-parser'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const context = {
  wallets: [{ name: 'GCash', type: 'ewallet' }, { name: 'GoTyme', type: 'bank' }, { name: 'Cash', type: 'cash' }, { name: 'BDO Unibank', type: 'bank' }, { name: 'Maya', type: 'ewallet' }],
  categories: [{ name: 'Food & Dining', type: 'expense' }, { name: 'Transportation', type: 'expense' }, { name: 'Groceries', type: 'expense' }, { name: 'Salary', type: 'income' }, { name: 'Bills & Utilities', type: 'expense' }],
  now: new Date(2026, 10, 13, 12, 0),
}

// Where the rules already answer, the hybrid returns the same thing.
for (const text of ['lunch 150 gcash', 'sahod 30000 bdo', 'gcash to gotyme 2000', 'grab 240 kahapon']) {
  const rules = parseTransactionText(text, context)
  const hybrid = await parseQuickAdd(text, context)
  const same = ['amount', 'type', 'fromWalletName', 'toWalletName', 'inferredCategoryName', 'date'].every((k) => (rules as any)[k] === (hybrid as any)[k])
  check(`unchanged: "${text}"`, same, { rules, hybrid })
}

// Where the rules come up empty, the tagger fills in and says so.
const glued = await parseQuickAdd('dinner320', context)
check('glued amount is found', glued.amount === 320 && (glued.evidence?.length ?? 0) > 0, glued)
// The agent only accepts an amount with confidence >= 0.5 (components/floating-agent.tsx). Check that gate, not just the number.
for (const text of ['lunch150', 'Lunch150', 'dinner320']) {
  const r = await parseQuickAdd(text, context)
  check(`"${text}" passes the agent's amount gate`, !!r.amount && r.confidence.amount >= 0.5, r)
}
const lunch = await parseQuickAdd('lunch150', context)
check('glued digits leave the description', lunch.description?.toLowerCase() === 'lunch', lunch.description)
const grab = await parseQuickAdd('grab 305 gcas', context)
check('wallet typo leaves the description', grab.fromWalletName === 'GCash' && !/gcas/i.test(grab.description ?? ''), grab.description)
const typo = await parseQuickAdd('jeep 13 gcas', context)
check('misspelt wallet is matched', typo.fromWalletName === 'GCash', typo)
const cat = await parseQuickAdd('grocries 1800', context)
check('misspelt category cue is matched', cat.inferredCategoryName === 'Groceries' && cat.amount === 1800, cat)

// Nothing is applied silently: evidence names every field the tagger changed.
check('evidence lists the overrides', (glued.evidence ?? []).some((e) => e.startsWith('amount')) && (typo.evidence ?? []).some((e) => e.includes('GCash')))

console.log(failures ? failures + ' FAILURES' : 'ALL PASSED')
process.exit(failures ? 1 : 0)
