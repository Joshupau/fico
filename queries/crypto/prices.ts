import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCoinPrices } from '@/utils/crypto-prices'
import { useSettingsStore } from '@/store/settings-store'
import type { Investment } from '@/types/investment'

export type LiveHolding = {
  /** Quantity times the price, in the app currency. */
  value: number
  price: number
  change24h: number | null
  /** When the price was fetched (ms). */
  at: number
  /** The live lookup failed, so this is the last known price. */
  stale: boolean
}

/** Live value of every active crypto holding that has a coin and a quantity. */
export function useLiveHoldings(investments: Investment[]) {
  const currency = useSettingsStore((state) => state.currency)

  const holdings = useMemo(
    () => investments.filter((i) => i.type === 'crypto' && i.coinId && Number(i.quantity) > 0 && i.status !== 'sold' && i.status !== 'archived'),
    [investments]
  )
  const ids = useMemo(() => [...new Set(holdings.map((i) => i.coinId as string))].sort(), [holdings])

  const query = useQuery({
    queryKey: ['coin-prices', currency, ids],
    queryFn: () => fetchCoinPrices(ids, currency),
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const liveById = useMemo(() => {
    const result: Record<string, LiveHolding> = {}
    const prices = query.data?.prices ?? {}
    // The server's price job runs every 30 minutes; older than two hours means it has stopped.
    const checkedAt = query.dataUpdatedAt
    for (const holding of holdings) {
      const quantity = Number(holding.quantity)
      const coin = prices[holding.coinId as string]
      // The server's last saved price, if it is newer than anything this device knows.
      const savedAt = holding.priceUpdatedAt ? Date.parse(holding.priceUpdatedAt) : 0
      const saved = Number(holding.lastPrice) > 0 && savedAt > 0 ? { price: Number(holding.lastPrice), at: savedAt } : null
      if (coin && (!saved || coin.at >= saved.at)) {
        result[holding.id] = { value: quantity * coin.price, price: coin.price, change24h: coin.change24h, at: coin.at, stale: coin.stale }
      } else if (saved) {
        result[holding.id] = { value: quantity * saved.price, price: saved.price, change24h: null, at: saved.at, stale: !checkedAt || checkedAt - saved.at > 2 * 3_600_000 }
      }
    }
    return result
  }, [holdings, query.data, query.dataUpdatedAt])

  return {
    holdings,
    liveById,
    loading: query.isLoading && ids.length > 0,
    stale: Object.values(liveById).some((h) => h.stale),
    failed: query.isError,
    fetchedAt: query.data?.fetchedAt ?? null,
    refetch: query.refetch,
  }
}
