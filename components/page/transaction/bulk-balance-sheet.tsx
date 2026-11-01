'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { TriangleAlert } from 'lucide-react'
import { chipClass, Field, FormSheet, fieldClass, scrollRowClass } from '@/components/ui/form-sheet'
import { useAffectsBalanceRangeCount, useSetAffectsBalanceRange } from '@/queries/user/transaction/transaction'
import type { SetAffectsBalanceRangeData } from '@/types/transaction'

interface BulkBalanceSheetProps {
  open: boolean
  onClose: () => void
  wallets: { id?: string; _id?: string; name?: string; status?: string }[]
}

/** First and last day of the last finished quarter, as yyyy-mm-dd: a sensible start for fixing history. */
const lastQuarter = () => {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const start = new Date(now.getFullYear(), (q - 1) * 3, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0)
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: ymd(start), end: ymd(end) }
}

/**
 * Bulk "Don't change wallet balance": switch the flag for every transaction in a date range.
 * By default no balance moves (the rows are marked as history and wallets keep what they hold now),
 * which is what imported or backfilled rows need.
 */
export function BulkBalanceSheet({ open, onClose, wallets }: BulkBalanceSheetProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [walletId, setWalletId] = useState('')
  const [keep, setKeep] = useState(true)
  const [adjust, setAdjust] = useState(false)
  const { mutate, isPending } = useSetAffectsBalanceRange()

  useEffect(() => {
    if (!open) return
    const range = lastQuarter()
    setStartDate(range.start)
    setEndDate(range.end)
    setWalletId('')
    setKeep(true)
    setAdjust(false)
  }, [open])

  const request = useMemo<SetAffectsBalanceRangeData | null>(
    () => (open && startDate && endDate ? { startDate, endDate, affectsBalance: !keep, walletId: walletId || undefined, adjustBalances: adjust } : null),
    [open, startDate, endDate, keep, walletId, adjust]
  )
  const badRange = !!startDate && !!endDate && endDate < startDate
  const { data: count, isFetching } = useAffectsBalanceRangeCount(badRange ? null : request)

  const activeWallets = wallets.filter((w) => w.status !== 'archived')
  const idOf = (w: { id?: string; _id?: string }) => String(w._id ?? w.id)

  const summary = badRange
    ? 'The end date is before the start date.'
    : isFetching || count === undefined
      ? 'Counting…'
      : count === 0
        ? `Nothing to change: every transaction in this range already ${keep ? 'leaves the balance alone' : 'changes the balance'}.`
        : `${count} transaction${count === 1 ? '' : 's'} will switch.`

  const warning = keep
    ? adjust
      ? 'Their amounts come back out of the wallet balances, as if they never happened. They still count in spending and reports.'
      : 'Wallet balances stay exactly as they are now. Afterwards, editing or deleting these transactions won’t move any balance.'
    : adjust
      ? 'Their amounts are applied to the wallet balances, once.'
      : 'Wallet balances stay as they are now, but editing or deleting these transactions will move them again.'

  const submit = () => {
    if (!request || badRange) return
    mutate(request, {
      onSuccess: ({ data }) => {
        toast.success(data.updated ? `Updated ${data.updated} transaction${data.updated === 1 ? '' : 's'}` : 'Nothing needed changing')
        onClose()
      },
    })
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title="Change many at once"
      description="Choose a date range and whether those transactions change wallet balances."
      submitLabel={count ? `Update ${count} transaction${count === 1 ? '' : 's'}` : 'Update'}
      onSubmit={submit}
      busy={isPending}
      submitDisabled={badRange || !count}
    >
      <div role="group" aria-label="Setting" className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {([
          [true, 'Don’t change balance'],
          [false, 'Change balance'],
        ] as const).map(([value, text]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={keep === value}
            onClick={() => setKeep(value)}
            className={`rounded-full py-2 text-sm font-semibold transition-colors ${keep === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="From" className={fieldClass} />
        </Field>
        <Field label="To">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="To" className={fieldClass} />
        </Field>
      </div>

      <Field label="Wallet">
        <div className={scrollRowClass}>
          <button type="button" aria-pressed={!walletId} onClick={() => setWalletId('')} className={chipClass(!walletId)}>
            All wallets
          </button>
          {activeWallets.map((w) => (
            <button key={idOf(w)} type="button" aria-pressed={walletId === idOf(w)} onClick={() => setWalletId(idOf(w))} className={chipClass(walletId === idOf(w))}>
              {w.name || 'Wallet'}
            </button>
          ))}
        </div>
      </Field>

      <div>
        <button type="button" aria-pressed={adjust} onClick={() => setAdjust((v) => !v)} className={chipClass(adjust)}>
          {keep ? 'Also take their amounts out of balances' : 'Also apply their amounts to balances'}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground" aria-live="polite">{summary}</p>
        <p className="flex items-start gap-1.5 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
          {warning}
        </p>
      </div>
    </FormSheet>
  )
}
