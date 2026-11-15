/**
 * Rules first, model second. The rules parser is precise when it fires; the tagger is used only
 * where the rules came up empty or unsure. Every override is listed in `evidence` so the review
 * UI (and the eval misses list) can say why a field changed.
 */
import type { QuickAddResult } from './decode'

/** The subset of Fico's ParsedTransaction the hybrid reads. */
export interface RulesResult {
  amount?: number
  type?: 'expense' | 'income' | 'transfer'
  fromWalletName?: string
  toWalletName?: string
  inferredCategoryName?: string
  date?: string
  serviceFee?: number
  description?: string
  confidence: { amount: number; type: number; date: number; category: number }
}

export interface HybridResult extends RulesResult {
  evidence: string[]
}

export function combine(rules: RulesResult, tagger: QuickAddResult): HybridResult {
  const out: HybridResult = { ...rules, evidence: [] }
  const note = (s: string) => out.evidence.push(s)

  if (rules.amount === undefined && tagger.amount !== undefined) {
    out.amount = tagger.amount
    note(`amount from tagger (${tagger.evidence.find((e) => e.startsWith('amount')) ?? ''})`)
  } else if (rules.amount !== undefined && tagger.amount !== undefined && rules.amount !== tagger.amount && rules.confidence.amount < 0.7 && tagger.confidence.amount >= 0.9) {
    out.amount = tagger.amount
    note(`amount ${rules.amount} -> ${tagger.amount} (rules unsure, tagger sure)`)
  }

  if (!rules.fromWalletName && tagger.fromWalletName && tagger.confidence.wallet >= 0.65) {
    out.fromWalletName = tagger.fromWalletName
    note(`wallet from tagger: ${tagger.fromWalletName}`)
  }
  if (!rules.toWalletName && tagger.toWalletName && (out.type === 'transfer' || tagger.type === 'transfer')) {
    out.toWalletName = tagger.toWalletName
    note(`to wallet from tagger: ${tagger.toWalletName}`)
  }

  // Type: the rules default to "expense" when no keyword matches. Let a confident tagger say income.
  if (rules.confidence.type < 0.6 && tagger.type && tagger.type !== rules.type && tagger.confidence.type >= 0.7) {
    // A transfer needs two different wallets of the user's own; "gcash to gcash ni mama" is a payment.
    const transferOk = tagger.type !== 'transfer' || (tagger.fromWalletName && tagger.toWalletName && tagger.fromWalletName !== tagger.toWalletName)
    if (transferOk) {
      out.type = tagger.type
      note(`type ${rules.type} -> ${tagger.type} (rules had no keyword)`)
      if (tagger.type === 'transfer' && !out.toWalletName && tagger.toWalletName) out.toWalletName = tagger.toWalletName
    }
  }

  if (!rules.inferredCategoryName && tagger.inferredCategoryName && tagger.confidence.category >= 0.4) {
    out.inferredCategoryName = tagger.inferredCategoryName
    note(`category from tagger: ${tagger.inferredCategoryName}`)
  }

  if (!rules.date && tagger.date) {
    out.date = tagger.date
    note(`date from tagger: ${tagger.date}`)
  }
  if (rules.serviceFee === undefined && tagger.serviceFee !== undefined) out.serviceFee = tagger.serviceFee
  return out
}
