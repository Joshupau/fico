import type { AmountErrorShape } from './types'

/**
 * How two different non-negative amounts relate as digit strings.
 * Transposition and decimal shift are rare by chance, so they are strong evidence of a typing or
 * extraction error. A single changed digit is weak evidence: adding a round amount such as 300.00
 * also changes exactly one digit.
 */
export function amountErrorShape(wrongMinor: number, rightMinor: number): AmountErrorShape {
  if (wrongMinor === rightMinor || wrongMinor < 0 || rightMinor < 0) return 'other'
  const a = String(wrongMinor)
  const b = String(rightMinor)

  for (const factor of [10, 100, 1000]) {
    if (wrongMinor * factor === rightMinor || rightMinor * factor === wrongMinor) return 'decimal_shift'
  }
  if (a.length === b.length) {
    if ([...a].sort().join('') === [...b].sort().join('')) return 'transposition'
    let different = 0
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different++
    if (different === 1) return 'digit_substitution'
  }
  return 'other'
}
