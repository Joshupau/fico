'use client'

import { TrendingUp, TrendingDown, Shuffle, MoreHorizontal } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { StatGrid, StatTile } from '@/components/ui/stat-tile'

interface TransactionStats {
  totalIncome: number
  totalExpense: number
  totalTransfers: number
  transactionCount: number
}

interface TransactionStatsProps {
  stats: TransactionStats
  isLoading?: boolean
}

export function TransactionStats({ stats, isLoading }: TransactionStatsProps) {
  const { currency } = useSettingsStore()

  return (
    <StatGrid>
      <StatTile
        label="Total Income"
        value={formatMoney(stats.totalIncome, currency, false)}
        icon={<TrendingUp className="w-5 h-5" />}
        tone="success"
        coloredValue
        hideable
        isLoading={isLoading}
      />
      <StatTile
        label="Total Expenses"
        value={formatMoney(stats.totalExpense, currency, false)}
        icon={<TrendingDown className="w-5 h-5" />}
        tone="destructive"
        coloredValue
        hideable
        isLoading={isLoading}
      />
      <StatTile
        label="Transfers"
        value={formatMoney(stats.totalTransfers, currency, false)}
        icon={<Shuffle className="w-5 h-5" />}
        tone="accent"
        coloredValue
        hideable
        isLoading={isLoading}
      />
      <StatTile
        label="Transactions"
        value={`${stats.transactionCount}`}
        icon={<MoreHorizontal className="w-5 h-5" />}
        tone="primary"
        coloredValue
        isLoading={isLoading}
      />
    </StatGrid>
  )
}
