'use client'

import { TrendingUp, Wallet, PiggyBank, CreditCard } from 'lucide-react'
import { formatMoney } from '@/utils/formatter'
import { StatGrid, StatTile } from '@/components/ui/stat-tile'

interface WalletOverviewProps {
  totalBalance: number
  currency: string
  activeWallets: number
  totalWallets: number
  monthlyIncome: number
  monthlyExpense: number
}

export function WalletOverview({
  totalBalance,
  currency,
  activeWallets,
  totalWallets,
  monthlyIncome,
  monthlyExpense,
}: WalletOverviewProps) {
  return (
    <StatGrid>
      <StatTile
        label="Total Balance"
        value={formatMoney(totalBalance, currency, false)}
        note={`Across ${activeWallets} active wallet${activeWallets !== 1 ? 's' : ''}`}
        icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
        tone="primary"
        hideable
      />
      <StatTile
        label="Active Wallets"
        value={`${activeWallets}`}
        note={`of ${totalWallets} total`}
        icon={<CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />}
        tone="accent"
      />
      <StatTile
        label="This Month Income"
        value={formatMoney(monthlyIncome, currency, false)}
        note="+12.5% from last month"
        icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
        tone="success"
        hideable
      />
      <StatTile
        label="This Month Expense"
        value={formatMoney(monthlyExpense, currency, false)}
        note="-8.3% from last month"
        icon={<PiggyBank className="w-4 h-4 sm:w-5 sm:h-5" />}
        tone="warning"
        hideable
      />
    </StatGrid>
  )
}
