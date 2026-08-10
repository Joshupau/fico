'use client'

import { useMemo } from 'react'
import { TrendingUp, Wallet, ShoppingCart, Zap } from 'lucide-react'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useQuickStats } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { StatGrid, StatTile } from '@/components/ui/stat-tile'

interface FinancialCard {
  title: string
  amount: string
  icon: React.ReactNode
  tone: 'primary' | 'success' | 'warning' | 'highlight'
  isLoading?: boolean
}

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all'

interface FinancialCardsProps {
  period?: PeriodType
}

export function FinancialCards({ period = 'month' }: FinancialCardsProps) {
  const { data: walletResponse, isLoading: walletsLoading } = useListWallets()
  const { data: quickStatsResponse, isLoading: quickStatsLoading } = useQuickStats({ period })
  const { currency } = useSettingsStore()

  const cards: FinancialCard[] = useMemo(() => {
    // Calculate total balance from wallets
    let totalBalance = 0
    const walletData = walletResponse?.data as any
    const wallets = Array.isArray(walletData)
      ? walletData
      : walletData?.items || walletData?.wallets || []

    if (Array.isArray(wallets)) {
      totalBalance = wallets.reduce((sum: number, w: any) => {
        const balance = Number(w.balance || w.currentBalance || 0)
        return w.status !== 'archived' ? sum + balance : sum
      }, 0)
    }

    // Extract data from quick stats
    const stats = quickStatsResponse?.data?.stats || {}
    const spentToday = quickStatsResponse?.data?.spentToday || {}
    const expenses = Number(stats.expenses || 0)
    const totalSpent = Number(spentToday.totalSpent || 0)
    const transactionCount = Number(stats.transactions || 0)

    return [
      {
        title: 'Total Balance',
        amount: formatMoney(totalBalance, currency),
        icon: <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />,
        tone: 'primary',
        isLoading: walletsLoading,
      },
      {
        title: 'Spent Today',
        amount: formatMoney(totalSpent, currency),
        icon: <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />,
        tone: 'success',
        isLoading: quickStatsLoading,
      },
      {
        title: 'Expenses',
        amount: formatMoney(expenses, currency),
        icon: <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />,
        tone: 'warning',
        isLoading: quickStatsLoading,
      },
      {
        title: 'Transactions',
        amount: `${transactionCount}`,
        icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6" />,
        tone: 'highlight',
        isLoading: quickStatsLoading,
      },
    ]
  }, [walletResponse, quickStatsResponse, walletsLoading, quickStatsLoading, currency])

  return (
    <StatGrid>
      {cards.map((card) => (
        <StatTile
          key={card.title}
          label={card.title}
          value={card.amount}
          icon={card.icon}
          tone={card.tone}
          hideable
          isLoading={card.isLoading}
        />
      ))}
    </StatGrid>
  )
}
