import { useMemo } from 'react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useOpenBills } from '@/queries/user/forecast/forecast'
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
  const { data: walletsResponse, isLoading: walletsLoading } = useListWallets({ limit: '100' })
  const { data: openBills, isLoading: billsLoading, isError: billsError } = useOpenBills()
  const { data: spentResponse, isLoading: spentLoading } = useSpentToday()

  const wallets = useMemo(() => asList(walletsResponse?.data), [walletsResponse])
  const spentToday = Number((spentResponse?.data as any)?.totalSpent) || 0

  const inputs = useMemo(() => {
    if (!supported || billsError || !walletsResponse || !openBills) return null
    return safeToSpendInputs({ wallets, openBills, spentToday, floor })
  }, [supported, billsError, walletsResponse, openBills, wallets, spentToday, floor])

  return { inputs, loading: supported && (walletsLoading || billsLoading || spentLoading), wallets }
}
