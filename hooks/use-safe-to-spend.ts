import { useMemo } from 'react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useOpenBills } from '@/queries/user/forecast/forecast'
import { useListPlannedItems } from '@/queries/user/planned/planned-items'
import { useSpentToday } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { safeToSpendInputs, type SafeToSpendInput } from '@/utils/safe-to-spend'

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

/**
 * Everything `safeToSpend` needs, read from data the app already loads. Open bills only come from the
 * Supabase backend, so on the local backend (or while loading) `inputs` is null and the answer is skipped.
 */
export function useSafeToSpendInputs(): { inputs: SafeToSpendInput | null; loading: boolean; wallets: any[] } {
  const supported = process.env.NEXT_PUBLIC_BACKEND === 'supabase'
  const floor = useSettingsStore((s) => s.safeToSpendFloor)
  const rules = useSettingsStore((s) => s.safeToSpendWallets)
  // Planned items are optional: if they fail to load, the answer goes ahead without them.
  const { data: planned, isLoading: plannedLoading } = useListPlannedItems()
  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets({ limit: '100' })
  const { data: openBills, isLoading: billsLoading, isError: billsError } = useOpenBills()
  const { data: spentResponse, isLoading: spentLoading } = useSpentToday()

  const wallets = useMemo(() => asList(walletsResponse?.data), [walletsResponse])
  const spentToday = Number((spentResponse?.data as any)?.totalSpent) || 0
  // Per-wallet spending, so turning a wallet off drops what was spent from it too. Older servers
  // don't send it, and then the total is used as is.
  const spentByWallet = (spentResponse?.data as any)?.byWallet as Record<string, number> | undefined

  const inputs = useMemo(() => {
    if (!supported || billsError || !walletsResponse || !openBills) return null
    return safeToSpendInputs({ wallets, openBills, planned: planned ?? [], rules, spentToday, spentByWallet, floor })
  }, [supported, billsError, walletsResponse, openBills, planned, rules, wallets, spentToday, spentByWallet, floor])

  return { inputs, loading: supported && (walletsLoading || billsLoading || spentLoading || plannedLoading), wallets }
}
