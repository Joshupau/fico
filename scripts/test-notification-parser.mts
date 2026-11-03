// Run: npx tsx scripts/test-notification-parser.mts
// NOTE: the sample texts below follow the usual wording of Philippine bank and e-wallet alerts but are
// written from the general shape, not copied from real notifications. Replace them with real ones
// as they are collected; the parser is meant to survive wording changes, not match a template.
import { parseNotification, makeDuplicateGuard, looksLikeMoneyMessage, messageDate } from '../utils/notification-parser'

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

// Real GCash SMS texts (shared by the user, Nov 2026). Their sender is only on the SMS, not in the text.
const gcashNow = new Date(2026, 10, 3, 18, 29)
const g = { now: gcashNow }
const grab = parseNotification({ text: 'Your payment of P101.00 to Grab Philippines has been successfully processed on 10-29-26 05:06:54 PM. Ref. No. 927809084', postedAt: gcashNow }, g)
check('gcash payment', grab?.type === 'expense' && grab.amount === 101 && grab.counterparty === 'Grab Philippines' && grab.description === 'Grab Philippines', grab)
check('gcash payment date is the printed one', grab?.date === '2026-10-29', grab)
check('gcash payment wallet from its wording', grab?.sourceWalletName === 'GCash', grab)
check('gcash payment reference', grab?.reference === '927809084', grab)
const spotify = parseNotification({ text: 'Your payment of P100.00 to SPOTIFY AB has been successfully processed on 10-29-26 11:12:41 AM. Ref. No. 926635165', postedAt: gcashNow }, g)
check('gcash subscription payment', spotify?.type === 'expense' && spotify.amount === 100 && spotify.counterparty === 'SPOTIFY AB', spotify)
const refund = parseNotification({ text: 'Your refund of P101.00 from Grab Philippines has been successfully credited to your Gcash wallet on 10-29-26 05:10:14 PM. Ref. No. 945461876', postedAt: gcashNow }, g)
check('gcash refund is income', refund?.type === 'income' && refund.amount === 101 && refund.sourceWalletName === 'GCash', refund)
check('gcash refund note', refund?.description === 'Refund from Grab Philippines', refund)
const remit = parseNotification({ text: 'You have received P1000.00 from Jasper james  De guzman on 11-02-2026 03:44 AM. This GCash remittance from GB has Reference Number KKc0tFaZ06. Your new balance is P1119.41. GCash Ref. No. 9046790604501', postedAt: gcashNow }, g)
check('gcash remittance amount is not cut to 100', remit?.amount === 1000, remit)
check('gcash remittance sender', remit?.type === 'income' && remit.counterparty === 'Jasper james De guzman', remit)
check('gcash remittance date', remit?.date === '2026-11-02', remit)
check('gcash remittance uses the GCash reference', remit?.reference === '9046790604501', remit)
check('linking notice is not a transaction', parseNotification({ text: 'You have successfully linked your GCash account to Spotify. Enjoy easier online shopping with GCash now!', postedAt: gcashNow }, g) === null)
const apple = parseNotification({ text: 'Your payment of P1,290.00 to Apple services has been successfully processed on 08-01-26 03:09:33 PM. Ref. No. 945186492', postedAt: gcashNow }, g)
check('gcash payment with thousands comma', apple?.amount === 1290 && apple.counterparty === 'Apple services' && apple.date === '2026-08-01', apple)
const tiktok = parseNotification({ text: 'Your payment of P1,537.08 to TikTok Repaymen has been successfully processed on 08-14-26 02:05:42 PM. Ref. No. 987310170', postedAt: gcashNow }, g)
check('gcash payment with centavos', tiktok?.amount === 1537.08 && tiktok.counterparty === 'TikTok Repaymen' && tiktok.reference === '987310170', tiktok)
const small = parseNotification({ text: 'Your payment of P50.00 to Grab Philippines has been successfully processed on 08-17-26 02:43:10 PM. Ref. No. 997781624', postedAt: gcashNow }, g)
check('gcash small payment', small?.amount === 50 && small.date === '2026-08-17', small)
check('auth code is not a transaction', parseNotification({ text: '608933 is your authentication code. For your protection, do not share this code with anyone.', postedAt: gcashNow }, g) === null)
check('failed payment is not a transaction', parseNotification({ text: "You don't have enough balance to complete your payment of P1,537.08 to TikTok Repaymen.", postedAt: gcashNow }, g) === null)

// Spotting a pasted alert.
check('alert looks like a money message', looksLikeMoneyMessage('Your payment of P101.00 to Grab Philippines has been successfully processed on 10-29-26 05:06:54 PM. Ref. No. 927809084'))
check('typed entry is not one', !looksLikeMoneyMessage('80 lunch cash'))
check('typed sentence is not one', !looksLikeMoneyMessage('spent 150 on lunch with friends at the mall'))

// Printed dates.
check('dd-mm with 2-digit year', messageDate('processed on 10-29-26 05:06', gcashNow) === '2026-10-29')
check('named month', messageDate('debited PHP 2,000.00 on 03Nov2026', gcashNow) === '2026-11-03')
check('future date ignored', messageDate('on 12-25-26', gcashNow) === undefined)
check('impossible date ignored', messageDate('on 02-30-26', gcashNow) === undefined)

console.log(`${passes} passed, ${failures} failed`)
if (failures) process.exit(1)
