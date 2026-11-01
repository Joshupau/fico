'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { FormSheet } from '@/components/ui/form-sheet'
import { useReconcileWallets } from '@/queries/user/transaction/transaction'
import { formatMoney } from '@/utils/formatter'
import { useSettingsStore } from '@/store/settings-store'

interface ReconcileSheetProps {
  open: boolean
  onClose: () => void
}

type Checked = { at: string; gaps: Record<string, number> }
const CHECKED_KEY = 'fico:reconcile-checked'

const readChecked = (): Checked | null => {
  try {
    const raw = window.localStorage.getItem(CHECKED_KEY)
    return raw ? (JSON.parse(raw) as Checked) : null
  } catch {
    return null
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Reconcile: each wallet's stored balance next to the sum of the transactions that change it.
 * The gap is normally the starting balance plus balances set by hand, so the useful signal is the
 * gap moving. "Mark as checked" remembers today's gaps on this device and later shows any change.
 */
export function ReconcileSheet({ open, onClose }: ReconcileSheetProps) {
  const { currency } = useSettingsStore()
  const { data: rows = [], isLoading } = useReconcileWallets(open)
  const [checked, setChecked] = useState<Checked | null>(null)

  useEffect(() => {
    if (open) setChecked(readChecked())
  }, [open])

  const markChecked = () => {
    const next: Checked = { at: new Date().toISOString(), gaps: Object.fromEntries(rows.map((r) => [r.walletId, r.difference])) }
    try {
      window.localStorage.setItem(CHECKED_KEY, JSON.stringify(next))
      setChecked(next)
      toast.success('Saved. Any change from here shows as drift.')
    } catch {
      toast.error('Could not save on this device')
    }
  }

  const visible = rows.filter((r) => r.status === 'active' || r.balanceTransactions > 0 || r.storedBalance !== 0)
  const money = (value: number, walletCurrency?: string) =>
    `${value < 0 ? '-' : ''}${formatMoney(Math.abs(value), walletCurrency || currency, false)}`

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title="Check balances"
      description="Compare each wallet's stored balance with its transactions to spot drift."
      submitLabel="Mark as checked"
      onSubmit={markChecked}
      submitDisabled={isLoading || rows.length === 0}
    >
      <p className="text-sm text-muted-foreground">
        The gap between a wallet&apos;s balance and its transactions is usually its starting balance plus any balance you set by
        hand. If a gap changes when you didn&apos;t do either, something drifted.
        {checked ? ` Last checked ${format(new Date(checked.at), 'MMM d, yyyy h:mm a')}.` : ''}
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const before = checked?.gaps[row.walletId]
            const drift = before === undefined ? null : round2(row.difference - before)
            const isCard = row.type === 'credit_card'
            return (
              <li key={row.walletId} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isCard ? 'Amount owed' : 'Balance'}
                      {row.status === 'archived' ? ' · Archived' : ''}
                    </p>
                  </div>
                  {drift !== null && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        drift === 0 ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {drift === 0 ? 'No drift' : `Drift ${drift > 0 ? '+' : '-'}${money(Math.abs(drift), row.currency)}`}
                    </span>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Stored</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{money(row.storedBalance, row.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Transactions</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{money(row.transactionBalance, row.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gap</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{money(row.difference, row.currency)}</dd>
                  </div>
                </dl>

                {row.nonBalanceTransactions > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {row.nonBalanceTransactions} transaction{row.nonBalanceTransactions === 1 ? '' : 's'} here don&apos;t change the balance and
                    aren&apos;t counted.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FormSheet>
  )
}
