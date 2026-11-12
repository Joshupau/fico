/**
 * Money as integer minor units (centavos for PHP). No floating point is used for any amount.
 * Amounts are plain numbers that must be safe integers, which covers about 90 trillion pesos.
 */

/** ISO 4217 code -> number of decimal places. Unknown currencies default to 2. */
const EXPONENTS: Record<string, number> = { PHP: 2, USD: 2, EUR: 2, SGD: 2, JPY: 0, KRW: 0, VND: 0, KWD: 3, BHD: 3 }

export const currencyExponent = (currency: string): number => EXPONENTS[currency.toUpperCase()] ?? 2

export type AmountResult = { ok: true; minor: number } | { ok: false; reason: 'empty' | 'not_a_number' | 'too_precise' | 'too_large' }

/**
 * Reads "1,234.56", "1.234,56", "₱1 234.50", "(250.00)", "-80", "2,500" or "12,50" into minor units.
 * The sign is kept: parentheses and a leading or trailing minus are negative.
 * Fails instead of rounding when the text has more decimals than the currency allows.
 */
export function parseAmount(text: string, currency = 'PHP'): AmountResult {
  const exponent = currencyExponent(currency)
  let s = text.trim()
  if (!s) return { ok: false, reason: 'empty' }

  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[₱$€£¥\s ]|PHP|Php|php/g, '')
  if (/^-/.test(s) || /-$/.test(s)) {
    negative = !negative
    s = s.replace(/^-|-$/g, '')
  }
  s = s.replace(/^\+/, '')
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, reason: 'not_a_number' }

  // Work out which character, if any, is the decimal separator.
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimalAt = -1
  if (lastDot >= 0 && lastComma >= 0) {
    decimalAt = Math.max(lastDot, lastComma)
  } else if (lastDot >= 0) {
    // "1.234.567" groups thousands; a single dot is a decimal point.
    decimalAt = s.indexOf('.') === lastDot ? lastDot : -1
  } else if (lastComma >= 0) {
    // "1,234" and "12,500" group thousands; "12,50" is a decimal comma.
    decimalAt = /^\d{1,3}(,\d{3})+$/.test(s) ? -1 : s.indexOf(',') === lastComma ? lastComma : -1
  }

  const wholeRaw = decimalAt >= 0 ? s.slice(0, decimalAt) : s
  if (/[.,]/.test(wholeRaw)) {
    // Separators left of the decimal point must be one consistent thousands separator in groups of three.
    const grouped = /^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.exec(wholeRaw)
    if (!grouped || (decimalAt >= 0 && grouped[1] === s[decimalAt])) return { ok: false, reason: 'not_a_number' }
  }
  const whole = wholeRaw.replace(/[.,]/g, '') || '0'
  let fraction = decimalAt >= 0 ? s.slice(decimalAt + 1) : ''
  if (/[.,]/.test(fraction)) return { ok: false, reason: 'not_a_number' }
  // Trailing zeros beyond the exponent are harmless ("10.500" in a 2-decimal currency is 10.50).
  while (fraction.length > exponent && fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  if (fraction.length > exponent) return { ok: false, reason: 'too_precise' }
  fraction = fraction.padEnd(exponent, '0')

  const digits = (whole + fraction).replace(/^0+(?=\d)/, '')
  if (digits.length > 15) return { ok: false, reason: 'too_large' }
  const minor = Number(digits)
  if (!Number.isSafeInteger(minor)) return { ok: false, reason: 'too_large' }
  return { ok: true, minor: negative && minor !== 0 ? -minor : minor }
}

/** 123456 -> "1,234.56". Built from integer digits, never from division. */
export function formatAmount(minor: number, currency = 'PHP'): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError('amount is not a safe integer')
  const exponent = currencyExponent(currency)
  const sign = minor < 0 ? '-' : ''
  const digits = String(Math.abs(minor)).padStart(exponent + 1, '0')
  const whole = digits.slice(0, digits.length - exponent).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = exponent ? '.' + digits.slice(-exponent) : ''
  return sign + whole + fraction
}

/** Minor units as a major-unit decimal string with no grouping, e.g. 123456 -> "1234.56". */
export function toDecimalString(minor: number, currency = 'PHP'): string {
  return formatAmount(minor, currency).replace(/,/g, '')
}

export function assertMinor(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer of minor units`)
  return value
}
