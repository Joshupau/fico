import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CurrencyCode, DateFormat, LandingPage, SettingsState } from '@/types/settings'

type SettingsActions = {
  setCurrency: (currency: CurrencyCode) => void
  setHideAmountsOnOpen: (hideAmountsOnOpen: boolean) => void
  toggleHideAmountsOnOpen: () => void
  setCompactLayout: (compactLayout: boolean) => void
  toggleCompactLayout: () => void
  setDefaultLandingPage: (defaultLandingPage: LandingPage) => void
  setDateFormat: (dateFormat: DateFormat) => void
  setOnboardingCompleted: (value: boolean) => void
  setSafeToSpendFloor: (value: number) => void
  setSafeToSpendWallet: (walletId: string, rule: { include?: boolean; min?: number }) => void
  resetSettings: () => void
}

export type SettingsStore = SettingsState & SettingsActions

export const DEFAULT_SETTINGS: SettingsState = {
  currency: 'USD',
  hideAmountsOnOpen: true,
  compactLayout: false,
  defaultLandingPage: '/dashboard',
  dateFormat: 'MM/DD/YYYY',
  onboardingCompleted: false,
  safeToSpendFloor: 0,
  safeToSpendWallets: {},
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setCurrency: (currency) => set({ currency }),
      setHideAmountsOnOpen: (hideAmountsOnOpen) => set({ hideAmountsOnOpen }),
      toggleHideAmountsOnOpen: () => set((state) => ({ hideAmountsOnOpen: !state.hideAmountsOnOpen })),
      setCompactLayout: (compactLayout) => set({ compactLayout }),
      toggleCompactLayout: () => set((state) => ({ compactLayout: !state.compactLayout })),
      setDefaultLandingPage: (defaultLandingPage) => set({ defaultLandingPage }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),
      setSafeToSpendFloor: (value) => set({ safeToSpendFloor: Math.max(0, Number(value) || 0) }),
      setSafeToSpendWallet: (walletId, rule) =>
        set((state) => ({
          safeToSpendWallets: { ...state.safeToSpendWallets, [walletId]: { ...state.safeToSpendWallets?.[walletId], ...rule } },
        })),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'settings-storage',
    }
  )
)
