import type { Token } from './tokenize'
import { looksLikeAmount } from './tokenize'

const shape = (t: string) =>
  t
    .replace(/[A-Z]/g, 'X')
    .replace(/[a-zÀ-ɏ]/g, 'x')
    .replace(/\d/g, 'd')
    .replace(/(.)\1+/g, '$1')

/**
 * Features for one token. Character n-grams carry most of the weight: they let a misspelled
 * "gcas" or "cofee" share evidence with "gcash" and "coffee", which is the point of the model.
 */
export function tokenFeatures(tokens: Token[], i: number, prevTag: string, prevTag2: string): string[] {
  const t = tokens[i] as Token
  const w = t.text.toLowerCase()
  const at = (k: number) => tokens[i + k]?.text.toLowerCase() ?? (k < 0 ? '<s>' : '</s>')
  const f: string[] = [
    'b',
    'w=' + w,
    'sh=' + shape(t.text),
    'p1=' + w.slice(0, 1),
    'p2=' + w.slice(0, 2),
    'p3=' + w.slice(0, 3),
    's1=' + w.slice(-1),
    's2=' + w.slice(-2),
    's3=' + w.slice(-3),
    'len=' + Math.min(w.length, 8),
    'pos=' + Math.min(i, 5),
    'rpos=' + Math.min(tokens.length - 1 - i, 5),
    'w-1=' + at(-1),
    'w+1=' + at(1),
    'w-2=' + at(-2),
    'w+2=' + at(2),
    'w-1w=' + at(-1) + '|' + w,
    'ww+1=' + w + '|' + at(1),
    't-1=' + prevTag,
    't-2t-1=' + prevTag2 + '|' + prevTag,
    't-1w=' + prevTag + '|' + w,
  ]
  if (looksLikeAmount(w)) {
    f.push('amt')
    if (/k$/.test(w)) f.push('amt_k')
    if (/[.,]/.test(w)) f.push('amt_punct')
    if (/^\d{1,2}$/.test(w)) f.push('amt_small')
    if (/^[₱p]|php/.test(w)) f.push('amt_cur')
  }
  // the token right after a digit run that was glued to a word
  if (i > 0 && (tokens[i - 1] as Token).end === t.start) f.push('glued_prev')
  if (i + 1 < tokens.length && (tokens[i + 1] as Token).start === t.end) f.push('glued_next')
  if (w.length >= 3) {
    const padded = `#${w}#`
    for (let k = 0; k + 3 <= padded.length; k++) f.push('c3=' + padded.slice(k, k + 3))
    if (w.length >= 4) for (let k = 0; k + 4 <= padded.length; k++) f.push('c4=' + padded.slice(k, k + 4))
  }
  return f
}

/** Message-level features for the type classifier (expense / income / transfer). */
export function messageFeatures(tokens: Token[], tags: string[]): string[] {
  const f: string[] = ['b']
  const words = tokens.map((t) => t.text.toLowerCase())
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as string
    f.push('w=' + w, 'p3=' + w.slice(0, 3), 's3=' + w.slice(-3))
    if (i + 1 < words.length) f.push('bg=' + w + '|' + words[i + 1])
    if (w.length >= 4) {
      const padded = `#${w}#`
      for (let k = 0; k + 4 <= padded.length; k++) f.push('c4=' + padded.slice(k, k + 4))
    }
  }
  const tagSet = new Set(tags.map((t) => t.replace(/^[BI]-/, '')))
  for (const t of tagSet) f.push('has=' + t)
  if (tagSet.has('WALLET_TO')) f.push('two_wallets')
  f.push('first=' + (words[0] ?? ''), 'last=' + (words[words.length - 1] ?? ''))
  return f
}
