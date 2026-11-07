import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// What the Pay & taxes page needs to know. Kept on this device only; nothing here is synced.
export type PayMode = 'employee' | 'freelancer'

interface PayState {
  mode: PayMode
  monthlyBasic: number
  /** Month (1-12) you started this job this year; 1 if you were already there in January. */
  startMonth: number
  unpaidLeaveDays: number
  /** Other bonuses and benefits this year, which share the ₱90,000 tax-free limit with the 13th month. */
  otherBenefits: number
  leaveCredits: number
  leaveUsed: number
  /** Expected gross for the year, for freelancers. */
  freelanceGross: number
  set: (patch: Partial<Omit<PayState, 'set'>>) => void
}

export const usePayStore = create<PayState>()(
  persist(
    (set) => ({
      mode: 'employee',
      monthlyBasic: 0,
      startMonth: 1,
      unpaidLeaveDays: 0,
      otherBenefits: 0,
      leaveCredits: 15,
      leaveUsed: 0,
      freelanceGross: 0,
      set: (patch) => set(patch),
    }),
    { name: 'fico-pay' }
  )
)
