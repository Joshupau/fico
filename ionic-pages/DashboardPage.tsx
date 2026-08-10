
import { useState } from 'react'
import { DashboardHeader } from '@/components/page/dashboard/dashboard-header'
import { FinancialCards } from '@/components/page/dashboard/financial-cards'
import { RecentTransactions } from '@/components/page/dashboard/recent-transactions'
import { SpendingChart, PeriodSummaryCard } from '@/components/page/dashboard/spending-chart'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check } from 'lucide-react'
import { StatisticsPreviewCard } from '@/components/page/dashboard/statistics-preview-card'

import { IonPage, IonContent } from '@ionic/react'
import { BillCalendarCard } from '@/components/page/dashboard/bill-calendar-card'

function IonicPage({ children }: { children: React.ReactNode }) {
  return <IonPage>{children}</IonPage>
}

function IonicContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <IonContent className={className}>{children}</IonContent>
}

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all'

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const [walletId, setWalletId] = useState<string>('')
  const { data: walletsResponse } = useListWallets()
  const periodOptions: { label: string; value: PeriodType }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'All Time', value: 'all' },
  ]

  const wallets = Array.isArray(walletsResponse?.data)
    ? walletsResponse.data
    : walletsResponse?.data?.items || []

  return (
    <IonicPage>
      <IonicContent className="bg-background text-foreground">
        {/* Header */}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground truncate">Welcome back! Here's your financial overview.</p>
            </div>

            {/* Combined Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="shrink-0 px-4 py-2 rounded-full bg-card border border-border text-foreground text-sm font-medium hover:border-foreground/50 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">Filters</span>
                    {/* <span className="font-semibold">{periodOptions.find(o => o.value === period)?.label}</span> */}
                    {walletId && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-semibold">{wallets.find((w: any) => (w._id || w.id) === walletId)?.name}</span>
                      </>
                    )}
                  </span>
                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4">
                <div className="space-y-4">
                  {/* Period Section */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Period</p>
                    <div className="space-y-1">
                      {periodOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPeriod(option.value)}
                          className="w-full px-3 py-2 text-sm text-left rounded hover:bg-secondary transition-colors flex items-center justify-between"
                        >
                          <span>{option.label}</span>
                          {period === option.value && <Check className="w-4 h-4 text-success" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wallet Section */}
                  {wallets.length > 0 && (
                    <>
                      <div className="border-t border-border" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Wallet</p>
                        <div className="space-y-1">
                          <button
                            onClick={() => setWalletId('')}
                            className="w-full px-3 py-2 text-sm text-left rounded hover:bg-secondary transition-colors flex items-center justify-between"
                          >
                            <span>All Wallets</span>
                            {!walletId && <Check className="w-4 h-4 text-success" />}
                          </button>
                          {wallets
                            .filter((w: any) => w.status !== 'archived')
                            .map((wallet: any) => (
                              <button
                                key={wallet._id || wallet.id}
                                onClick={() => setWalletId(wallet._id || wallet.id)}
                                className="w-full px-3 py-2 text-sm text-left rounded hover:bg-secondary transition-colors flex items-center justify-between"
                              >
                                <span>{wallet.name}</span>
                                {walletId === (wallet._id || wallet.id) && <Check className="w-4 h-4 text-success" />}
                              </button>
                            ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="mb-6">
            <StatisticsPreviewCard period={period} walletId={walletId || undefined} />
          </div>

          {/* Financial Cards */}
          <div className="mb-6">
            <FinancialCards period={period} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 min-h-[280px]">
              <RecentTransactions />
            </div>
            <div className="lg:col-span-1">
              <BillCalendarCard />
            </div>
          </div>
        </main>
      </IonicContent>
    </IonicPage>
  )
}
