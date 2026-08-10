export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'PHP' | 'NGN' | 'GHS' | 'KES' | 'ZAR'

export type LandingPage = '/dashboard' | '/transactions' | '/wallets' | '/bills' | '/budgets'

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  PHP: '₱',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency]
}

export interface SettingsState {
  currency: CurrencyCode
  hideAmountsOnOpen: boolean
  compactLayout: boolean
  defaultLandingPage: LandingPage
  dateFormat: DateFormat
  onboardingCompleted: boolean
}
