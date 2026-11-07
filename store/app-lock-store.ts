import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// App lock settings (on this device). `locked` itself is not saved: a fresh start is always locked
// when the lock is on, which AppLock decides on mount.
interface AppLockState {
  enabled: boolean
  salt: string | null
  pinHash: string | null
  /** Digits in the PIN, so the keypad can unlock as soon as the last one is typed. */
  pinLength: number
  timeoutMin: number
  biometricId: string | null
  failures: number
  lockedUntil: number
  hiddenAt: number | null
  locked: boolean
  set: (patch: Partial<Omit<AppLockState, 'set' | 'disable'>>) => void
  disable: () => void
}

export const useAppLock = create<AppLockState>()(
  persist(
    (set) => ({
      enabled: false,
      salt: null,
      pinHash: null,
      pinLength: 4,
      timeoutMin: 1,
      biometricId: null,
      failures: 0,
      lockedUntil: 0,
      hiddenAt: null,
      locked: false,
      set: (patch) => set(patch),
      disable: () => set({ enabled: false, salt: null, pinHash: null, biometricId: null, failures: 0, lockedUntil: 0, locked: false }),
    }),
    {
      name: 'fico-app-lock',
      partialize: ({ enabled, salt, pinHash, pinLength, timeoutMin, biometricId, failures, lockedUntil, hiddenAt }) => ({ enabled, salt, pinHash, pinLength, timeoutMin, biometricId, failures, lockedUntil, hiddenAt }),
    }
  )
)
