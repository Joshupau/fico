'use client'

import { useMemo, useState } from 'react'
import { addDays, addHours, addMonths, format } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { useTransactionChartData } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { describePeriod, getPeriodRange, isShiftablePeriod } from '@/queries/user/transaction/period-range'
import { SliceTransactionsSheet, type Slice } from '@/components/page/statistics/slice-transactions-sheet'

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all'

interface ChartProps {
  period: PeriodType
  walletId?: string
  /** Steps back from the current period (0 or negative). */
  offset?: number
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { currency, hideAmountsOnOpen } = useSettingsStore.getState()
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-ios-lg text-xs space-y-1.5">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey as string} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-medium text-foreground">{formatMoney(Number(entry.value) || 0, currency, hideAmountsOnOpen)}</span>
        </div>
      ))}
    </div>
  )
}

/** The window one chart point covers: an hour, a day or a month of the period. */
function slotWindow(period: PeriodType, offset: number, index: number): { start: Date; end: Date } | null {
  if (!isShiftablePeriod(period)) return null
  const { start } = getPeriodRange(period, offset)
  if (period === 'today') return { start: addHours(start, index), end: addHours(start, index + 1) }
  if (period === 'year') return { start: addMonths(start, index), end: addMonths(start, index + 1) }
  return { start: addDays(start, index), end: addDays(start, index + 1) }
}

export function SpendingChart({ period, walletId, offset = 0 }: ChartProps) {
  const { data: chartDataResponse, isLoading } = useTransactionChartData({ period, walletId, offset })
  const { currency } = useSettingsStore()
  const [slice, setSlice] = useState<Slice | null>(null)

  const openPoint = (index: number | undefined) => {
    if (index === undefined || index === null) return
    const slot = slotWindow(period, offset, Number(index))
    if (!slot) return
    const title =
      period === 'today' ? `${format(slot.start, 'h a')} – ${format(slot.end, 'h a')}` : period === 'year' ? format(slot.start, 'MMMM yyyy') : format(slot.start, 'EEEE, MMM d')
    setSlice({ title, subtitle: 'Income and expenses', start: slot.start, end: slot.end, walletId })
  }

  const { chartData } = useMemo(() => {
    const raw = chartDataResponse?.data
    if (!raw) return { chartData: [] }

    const dataPoints: any[] = raw.dataPoints || []

    return {
      chartData: dataPoints.map((p) => ({
        label: p.day || p.date || p.year || p.month,
        Income: p.income,
        Expenses: p.expenses,
      })),
    }
  }, [chartDataResponse, period])

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-ios flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-foreground">Spending Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {describePeriod(period, offset)}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-muted-foreground">Income</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Expenses</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex-1 min-h-[180px] bg-secondary rounded-lg animate-pulse" />
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              onClick={(state: any) => openPoint(state?.activeTooltipIndex)}
              style={{ cursor: isShiftablePeriod(period) ? 'pointer' : undefined }}
            >
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatMoney(Number(v) || 0, currency, false)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Income"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradIncome)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#22c55e' }}
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradExpenses)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {isShiftablePeriod(period) && !isLoading && <p className="mt-2 text-[11px] text-muted-foreground">Tap a point to see its transactions.</p>}
      <SliceTransactionsSheet slice={slice} onClose={() => setSlice(null)} />
    </div>
  )
}

export function PeriodSummaryCard({ period, walletId, offset = 0 }: ChartProps) {
  const { data: chartDataResponse, isLoading } = useTransactionChartData({ period, walletId, offset })
  const { currency } = useSettingsStore()

  const totals = useMemo(() => {
    const raw = chartDataResponse?.data
    if (!raw) return { income: 0, expenses: 0, transfers: 0 }
    return raw.totals || { income: 0, expenses: 0, transfers: 0 }
  }, [chartDataResponse])

  const net = totals.income - totals.expenses
  const isPositive = net >= 0
  const total = totals.income + totals.expenses
  const incomeRatio = total > 0 ? Math.round((totals.income / total) * 100) : 50

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-ios flex flex-col h-full">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">Period Summary</h3>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
          {describePeriod(period, offset)}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 flex-1">
          <div className="h-8 bg-secondary rounded animate-pulse" />
          <div className="h-6 bg-secondary rounded animate-pulse" />
          <div className="h-6 bg-secondary rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Net flow */}
          <div className="pb-4 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">Net Flow</p>
            <div className={`flex items-center gap-2 ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-xl font-bold truncate">
                {`${isPositive ? '+' : ''}${formatMoney(Math.abs(net), currency, false)}`}
              </span>
            </div>
          </div>

          {/* Income row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                Income
              </span>
              <span className="font-semibold text-success">{formatMoney(totals.income, currency, false)}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-700"
                style={{ width: `${incomeRatio}%` }}
              />
            </div>
          </div>

          {/* Expenses row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                Expenses
              </span>
              <span className="font-semibold text-destructive">{formatMoney(totals.expenses, currency, false)}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-destructive rounded-full transition-all duration-700"
                style={{ width: `${100 - incomeRatio}%` }}
              />
            </div>
          </div>

          {/* Income vs Expenses ratio bar */}
          {total > 0 && (
            <div className="space-y-1.5 pb-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Income / Expense ratio</p>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                <div
                  className="bg-success rounded-l-full transition-all duration-700"
                  style={{ width: `${incomeRatio}%` }}
                />
                <div
                  className="bg-destructive rounded-r-full transition-all duration-700"
                  style={{ width: `${100 - incomeRatio}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{incomeRatio}% income</span>
                <span>{100 - incomeRatio}% expenses</span>
              </div>
            </div>
          )}

          {/* Transfers */}
          {totals.transfers > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-accent" />
                  Transfers
                </span>
                <span className="font-semibold text-accent">{formatMoney(totals.transfers, currency, false)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
