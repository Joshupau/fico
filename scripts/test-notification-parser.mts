// Run: npx tsx scripts/test-notification-parser.mts
// NOTE: the sample texts below follow the usual wording of Philippine bank and e-wallet alerts but are
// written from the general shape, not copied from real notifications. Replace them with real ones
// as they are collected; the parser is meant to survive wording changes, not match a template.
import { parseNotification, makeDuplicateGuard } from '../utils/notification-parser'

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++
  else {
    failures++
    console.log('FAIL', label, JSON.stringify(extra))
  }
}

const now = new Date(2026, 10, 3, 12, 0)
const ctx = { now }

const income = parseNotification({ text: 'You have received PHP 1,500.00 of GCash from JUAN DELA CRUZ. Ref. No. 1234567890.', packageName: 'com.globe.gcash.android', postedAt: now }, ctx)
check('gcash income', income?.type === 'income' && income.amount === 1500 && income.sourceWalletName === 'GCash' && income.counterparty === 'JUAN DELA CRUZ', income)
check('reference read', income?.reference === '1234567890', income)

const pay = parseNotification({ text: 'Payment of PHP 149.00 to JOLLIBEE via Maya was successful. Ref 99887766AA.', postedAt: now }, ctx)
check('maya payment by keyword', pay?.type === 'expense' && pay.amount === 149 && pay.sourceWalletName === 'Maya', pay)

const bank = parseNotification({ text: 'BDO: Your account was debited PHP 2,000.00 on 03Nov2026 for ATM withdrawal.', postedAt: now }, ctx)
check('bank debit', bank?.type === 'expense' && bank.amount === 2000 && bank.sourceWalletName === 'BDO', bank)

const salary = parseNotification({ text: 'GoTyme: PHP 12,500.00 has been credited to your account.', postedAt: now }, ctx)
check('credit is income', salary?.type === 'income' && salary.amount === 12500 && salary.sourceWalletName === 'GoTyme', salary)

const symbol = parseNotification({ text: 'You paid ₱89.50 to 7-ELEVEN', postedAt: now }, ctx)
check('peso sign and decimals', symbol?.amount === 89.5 && symbol.type === 'expense', symbol)

// Things that must not become transactions.
check('otp ignored', parseNotification({ text: 'Your OTP is 123456. Never share it. PHP 500.00 payment to SHOPEE', postedAt: now }, ctx) === null)
check('balance alert ignored', parseNotification({ text: 'Your available balance is PHP 4,300.00', postedAt: now }, ctx) === null)
check('no amount ignored', parseNotification({ text: 'You have a new message from GCash', postedAt: now }, ctx) === null)
check('empty ignored', parseNotification({ text: '   ' }, ctx) === null)

// Mixed words: "payment received" is money in.
const mixed = parseNotification({ text: 'Payment received: PHP 700.00 from MARIA', postedAt: now }, ctx)
check('payment received is income', mixed?.type === 'income' && mixed.amount === 700, mixed)
check('mixed words lower confidence', (mixed?.confidence.type ?? 1) < 0.9, mixed)

// Duplicates.
const seen = makeDuplicateGuard()
const a = parseNotification({ text: 'You have received PHP 300.00 from ANA. Ref. No. ABC12345678', packageName: 'com.globe.gcash.android', postedAt: now }, ctx)!
check('first is new', seen(a, 1_000) === false)
check('same reference is a duplicate', seen(a, 60_000) === true)
const b = parseNotification({ text: 'You have received PHP 300.00 from ANA.', packageName: 'com.globe.gcash.android', postedAt: now }, ctx)!
check('same shape within the window is a duplicate', seen(b, 90_000) === true)
check('same shape long after is new', seen(b, 10 * 60_000) === false)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
