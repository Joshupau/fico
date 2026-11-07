// Runs the milestone rules (utils/milestones.ts) after real money moves, using what's already loaded.

import { useCallback } from 'react'
import { useListInvestments } from '@/queries/user/investment/investments'
import { useListGoals } from '@/queries/user/goal/goals'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useCelebrateMilestones } from '@/queries/user/milestone/milestones'
import { asGoalWallets, goalProgress } from '@/components/page/goals/goal-progress'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { goalMilestones, investMilestones, type HoldingState, type Milestone } from '@/utils/milestones'

/* eslint-disable @typescript-eslint/no-explicit-any */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.wallets) ? data.wallets : [])
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Amounts in milestone messages follow "Hide amounts on open". */
export const useMilestoneMoney = () => {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  return useCallback((n: number) => formatMoney(n, currency, hideAmountsOnOpen), [currency, hideAmountsOnOpen])
}

/** The portfolio as milestone input, from the same list the Investments page loads. */
export function useHoldings(): HoldingState[] {
  const { data } = useListInvestments({ limit: '100' })
  return asList(data?.data)
    .filter((i) => i.status !== 'archived' && i.status !== 'sold')
    .map((i) => ({
      id: String(i._id ?? i.id),
      name: String(i.name),
      principal: Number(i.principalAmount) || 0,
      value: Number(i.currentValue) || 0,
      returns: Number(i.dividendsReceived) || 0,
    }))
}

export function useInvestMilestones() {
  const holdings = useHoldings()
  const celebrateFound = useCelebrateMilestones()
  const money = useMilestoneMoney()
  /** `change` turns the current holdings into the ones after the save. */
  return useCallback(
    (change: (before: HoldingState[]) => HoldingState[]) => celebrateFound(investMilestones(holdings, change(holdings), { money })),
    [holdings, celebrateFound, money]
  )
}

/**
 * Goal milestones after money moves between wallets: `deltas` maps wallet id to the change in its
 * balance. Only goals counting those wallets can cross a line.
 */
export function useGoalMilestones() {
  const { data: goalsResponse } = useListGoals()
  const { data: walletsResponse } = useListWallets()
  const celebrateFound = useCelebrateMilestones()
  const money = useMilestoneMoney()
  return useCallback(
    (deltas: Record<string, number>) => {
      const wallets = asGoalWallets(walletsResponse?.data)
      const after = wallets.map((w) => ({ ...w, balance: w.balance + (deltas[w.id] ?? 0) }))
      const found: Milestone[] = []
      for (const goal of goalsResponse?.data ?? []) {
        if (goal.status === 'archived') continue
        const before = goalProgress(goal, wallets).saved
        const now = goalProgress(goal, after).saved
        found.push(...goalMilestones({ id: goal.id, name: goal.name, target: Number(goal.targetAmount) || 0 }, before, now, { money }))
      }
      return celebrateFound(found)
    },
    [goalsResponse, walletsResponse, celebrateFound, money]
  )
}
