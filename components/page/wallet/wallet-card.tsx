'use client'

import { CreditCard, Wallet, DollarSign, Eye, EyeOff, MoreVertical, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface WalletCardProps {
  id: string
  name: string
  type: 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other'
  balance: number
  currency: string
  color?: string
  icon?: string
  accountNumber?: string
  status: 'active' | 'archived'
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onTransfer?: (id: string) => void
  onReceive?: (id: string) => void
}

export function WalletCard({
  id,
  name,
  type,
  balance,
  currency,
  color = '#0066CC',
  icon,
  accountNumber,
  status,
  onEdit,
  onArchive,
  onTransfer,
  onReceive,
}: WalletCardProps) {
  const { hideAmountsOnOpen } = useSettingsStore()
  const [showBalance, setShowBalance] = useState(!hideAmountsOnOpen)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    setShowBalance(!hideAmountsOnOpen)
  }, [hideAmountsOnOpen])

  const getWalletIcon = () => {
    switch (type) {
      case 'bank':
        return <CreditCard className="w-6 h-6" />
      case 'credit_card':
        return <CreditCard className="w-6 h-6" />
      case 'ewallet':
        return <Wallet className="w-6 h-6" />
      case 'cash':
        return <DollarSign className="w-6 h-6" />
      default:
        return <Wallet className="w-6 h-6" />
    }
  }

  const getWalletLabel = () => {
    const labels: Record<string, string> = {
      bank: 'Bank Account',
      cash: 'Cash',
      ewallet: 'E-Wallet',
      credit_card: 'Credit Card',
      other: 'Other',
    }
    return labels[type]
  }

  const displayBalance = formatMoney(balance, currency, !showBalance)

  return (
    <div
      className="group relative bg-gradient-to-br from-card to-secondary border border-border rounded-2xl p-6 shadow-ios hover:shadow-ios-lg transition-all duration-300 overflow-hidden"
      style={{
        borderColor: color,
      }}
    >
      {/* Background accent */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-10 blur-3xl"
        style={{ backgroundColor: color }}
      />

      {/* Header with icon and menu */}
      <div className="relative z-10 flex items-start justify-between mb-8">
        <div
          className="p-3 rounded-2xl text-white"
          style={{ backgroundColor: color }}
        >
          {getWalletIcon()}
        </div>

        {status === 'active' && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-ios-lg py-1 z-50">
                <button
                  onClick={() => {
                    onEdit?.(id)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Edit Wallet
                </button>
                <button
                  onClick={() => {
                    onTransfer?.(id)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  Transfer Money
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => {
                    onArchive?.(id)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-secondary transition-colors"
                >
                  Archive
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wallet Info */}
      <div className="relative z-10 mb-6">
        <p className="text-sm text-muted-foreground mb-1">{getWalletLabel()}</p>
        <h3 className="text-lg font-semibold text-foreground">{name}</h3>
        {accountNumber && (
          <p className="text-xs text-muted-foreground mt-1">••••{accountNumber.slice(-4)}</p>
        )}
      </div>

      {/* Balance */}
      <div className="relative z-10 mb-6">
        <p className="text-xs text-muted-foreground mb-2">Balance</p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-foreground">{displayBalance}</p>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="relative z-10 flex gap-2">
        <button
          onClick={() => onTransfer?.(id)}
          className="flex-1 px-3 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
        <button
          onClick={() => onReceive?.(id)}
          className="flex-1 px-3 py-2 rounded-full bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Receive</span>
        </button>
      </div>

      {status === 'archived' && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <span className="text-sm font-medium text-muted-foreground">Archived</span>
        </div>
      )}
    </div>
  )
}
