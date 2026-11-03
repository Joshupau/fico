import type { TransactionType } from '@/types/transaction'
import { parseTransactionText, type ParseContext, type ParsedTransaction } from '@/utils/transaction-parser'

/**
 * Turns the text of a bank or e-wallet notification into a transaction to confirm.
 *
 * Banks and wallets word these differently and change them without notice, so the parser looks for
 * the pieces every one of them carries (an amount, a direction, who it was from or to) and does not
 * depend on an exact template. Anything it cannot read gives `null`, and the user is never shown a
 * guess as if it were certain: a result always carries `confidence` and is meant to be confirmed.
 *
 * It runs offline on the text only, so it can be fed by an Android notification listener, a shared
 * SMS, or text pasted into the app.
 */

export type NotificationSource = {
  /** Wallet name as the app knows it, used to pick the wallet. */
  walletName: string
  /** Android package names that send these notifications. */
  packages: string[]
  /** Words in the text that identify the sender when the package is not known. */
  keywords: RegExp
}

export const NOTIFICATION_SOURCES: NotificationSource[] = [
  { walletName: 'GCash', packages: ['com.globe.gcash.android'], keywords: /\bg-?cash\b/i },
  { walletName: 'Maya', packages: ['com.paymaya'], keywords: /\bmaya\b|\bpaymaya\b/i },
  { walletName: 'GoTyme', packages: ['com.gotyme.bank', 'ph.gotyme.app'], keywords: /\bgotyme\b/i },
  { walletName: 'BDO', packages: ['ph.com.bdo.mobile', 'com.bdo.mobilebanking'], keywords: /\bbdo\b/i },
  { walletName: 'BPI', packages: ['com.bpi.ng.app'], keywords: /\bbpi\b/i },
  { walletName: 'UnionBank', packages: ['com.unionbankph.online'], keywords: /\bunionbank\b|\bubp\b/i },
  { walletName: 'SeaBank', packages: ['com.seabank.seabank'], keywords: /\bseabank\b/i },
]

export type NotificationInput = {
  text: string
  /** Android package that posted the notification, when known. */
  packageName?: string
  /** When the notification arrived. Defaults to now. */
  postedAt?: Date
}

export type ParsedNotification = ParsedTransaction & {
  /** The wallet the notification came from, when the sender is recognised. */
  sourceWalletName?: string
  /** The other party: who paid you, or who you paid. */
  counterparty?: string
  /** Reference number printed in the message, used to avoid logging the same one twice. */
  reference?: string
}

const AMOUNT = /(?:php|₱|p)\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i

// Direction words, most specific first. "cash in" moves money in; "cash out" moves it out.
const INCOME_WORDS = /\b(received|you(?:'ve| have)? got|cash[\s-]?in|credited|deposit(?:ed)?|incoming|refund(?:ed)?|salary|nag-?receive)\b/i
const EXPENSE_WORDS = /\b(paid|payment|purchase|purchased|bought|cash[\s-]?out|withdraw(?:n|al)?|debited|charged|spent|bill(?:s)? payment|nag-?bayad)\b/i
// Verbs that mean money left. "payment" alone can be either ("payment received"), so it is not one of them.
const STRONG_EXPENSE = /\b(paid|bought|spent|debited|charged|cash[\s-]?out|withdraw(?:n|al)?|nag-?bayad)\b/i
const TRANSFER_WORDS = /\b(transferred|transfer(?:red)? to|moved|sent)\b/i

const REF = /\b(?:ref(?:erence)?(?:\.|\s)?\s?(?:no\.?|number|#)?\s?:?\s?)([A-Z0-9]{6,})\b/i

function senderOf(input: NotificationInput): NotificationSource | undefined {
  if (input.packageName) {
    const byPackage = NOTIFICATION_SOURCES.find((s) => s.packages.includes(input.packageName!))
    if (byPackage) return byPackage
  }
  return NOTIFICATION_SOURCES.find((s) => s.keywords.test(input.text))
}

function counterpartyOf(text: string, type: TransactionType): string | undefined {
  // "from JUAN DELA CRUZ", "to MERCHANT NAME". Stop at a full stop, comma, "on", "via" or a reference.
  const stop = String.raw`(?=\s*(?:[.,;]|\bon\b|\bvia\b|\bref\b|\bat\b|\bwith\b|$))`
  const pick = (word: string) => new RegExp(String.raw`\b${word}\s+([A-Za-z0-9][A-Za-z0-9 &'.\-]{1,40}?)` + stop, 'i').exec(text)?.[1]?.trim()
  const raw = type === 'income' ? pick('from') : pick('to')
  if (!raw) return undefined
  // A date, an amount or a word like "your" is not a name.
  if (/^(your|my|the|php|₱|\d)/i.test(raw)) return undefined
  return raw.replace(/\s+/g, ' ')
}

export function parseNotification(input: NotificationInput, context: ParseContext = {}): ParsedNotification | null {
  const text = input.text.replace(/\s+/g, ' ').trim()
  if (!text) return null

  const amountMatch = AMOUNT.exec(text)
  if (!amountMatch) return null
  const amount = Number(amountMatch[1].replace(/,/g, ''))
  if (!isFinite(amount) || amount <= 0) return null

  // One-time passwords and balance alerts carry amounts but are not transactions.
  if (/\b(otp|one[\s-]?time|verification code|your (?:available )?balance is|login|logged in)\b/i.test(text)) return null

  let type: TransactionType | undefined
  let typeConfidence = 0.9
  const income = INCOME_WORDS.test(text)
  const expense = EXPENSE_WORDS.test(text)
  const transfer = TRANSFER_WORDS.test(text)
  if (income && !expense) type = 'income'
  else if (expense && !income) type = 'expense'
  else if (transfer && !income) {
    type = 'expense'
    typeConfidence = 0.7
  } else if (income && expense) {
    // "Payment received" is money in; "paid ... received by" is money out. Without a clear
    // outgoing verb it is income, otherwise the earlier verb wins.
    const i = text.search(INCOME_WORDS)
    const e = text.search(STRONG_EXPENSE)
    type = e < 0 || i < e ? 'income' : 'expense'
    typeConfidence = 0.6
  }
  if (!type) return null

  const sender = senderOf(input)
  const counterparty = counterpartyOf(text, type)
  const reference = REF.exec(text)?.[1]

  // Reuse the chat parser for the date, wallet and category, on a cleaned line it already understands.
  const cleaned = `${type === 'income' ? 'Received' : 'Spent'} ${amount} ${counterparty ?? ''}`.trim()
  const base = parseTransactionText(cleaned, { ...context, now: input.postedAt ?? context.now })

  return {
    ...base,
    amount,
    type,
    description: counterparty ?? base.description ?? (type === 'income' ? 'Received' : 'Payment'),
    date: base.date,
    fromWalletName: sender?.walletName ?? base.fromWalletName,
    sourceWalletName: sender?.walletName,
    counterparty,
    reference,
    confidence: { ...base.confidence, amount: 0.95, type: typeConfidence },
  }
}

/**
 * Notifications arrive more than once (a push and an SMS, or a retry). Keeps what has been seen so
 * the same reference, or the same amount from the same sender within a short window, is logged once.
 */
export function makeDuplicateGuard(windowMs = 2 * 60 * 1000) {
  const seen = new Map<string, number>()
  return (parsed: ParsedNotification, at: number = Date.now()): boolean => {
    for (const [key, time] of seen) if (at - time > Math.max(windowMs, 24 * 60 * 60 * 1000)) seen.delete(key)
    const byRef = parsed.reference ? `ref:${parsed.reference}` : null
    const byShape = `${parsed.sourceWalletName ?? ''}|${parsed.type}|${parsed.amount}|${parsed.counterparty ?? ''}`
    if (byRef && seen.has(byRef)) return true
    const last = seen.get(byShape)
    if (last !== undefined && at - last < windowMs) return true
    if (byRef) seen.set(byRef, at)
    seen.set(byShape, at)
    return false
  }
}
