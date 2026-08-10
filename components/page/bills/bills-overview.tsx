import { ReceiptText, AlarmClock, CircleX, CircleCheck } from 'lucide-react'
import { BillSummary } from '@/types/bill'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { StatGrid, StatTile } from '@/components/ui/stat-tile'

interface BillsOverviewProps {
  summary: BillSummary
  upcomingCount: number
  overdueCount: number
  isLoading?: boolean
}

export function BillsOverview({ summary, upcomingCount, overdueCount, isLoading }: BillsOverviewProps) {
  const { currency } = useSettingsStore()

  return (
    <StatGrid>
      <StatTile
        label="Total Bill Amount"
        value={formatMoney(summary.totalAmount, currency, false)}
        note={`${summary.totalBills} total bill${summary.totalBills === 1 ? '' : 's'}`}
        icon={<ReceiptText className="w-5 h-5" />}
        tone="primary"
        hideable
        isLoading={isLoading}
      />
      <StatTile
        label="Due Soon"
        value={`${upcomingCount}`}
        note={`${summary.unpaidBills} unpaid bill${summary.unpaidBills === 1 ? '' : 's'}`}
        icon={<AlarmClock className="w-5 h-5" />}
        tone="warning"
        isLoading={isLoading}
      />
      <StatTile
        label="Overdue Bills"
        value={`${overdueCount}`}
        note={formatMoney(summary.unpaidAmount, currency, false)}
        icon={<CircleX className="w-5 h-5" />}
        tone="destructive"
        hideable
        isLoading={isLoading}
      />
      <StatTile
        label="Paid Amount"
        value={formatMoney(summary.paidAmount, currency, false)}
        note={`${summary.paidBills} paid bill${summary.paidBills === 1 ? '' : 's'}`}
        icon={<CircleCheck className="w-5 h-5" />}
        tone="success"
        hideable
        isLoading={isLoading}
      />
    </StatGrid>
  )
}
