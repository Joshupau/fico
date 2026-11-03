'use client'

import { useMemo, useState } from 'react'
import { Moon, PiggyBank, Plus, ThumbsUp } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { QuickAddSheet } from '@/components/page/transaction/quick-add-sheet'
import { useSafeToSpendInputs } from '@/hooks/use-safe-to-spend'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { safeToSpend, walletCounts } from '@/utils/safe-to-spend'

const idOf = (w: any) => String(w._id ?? w.id ?? '')

/**
 * The evening check-in: how today went against the safe-to-spend pace, with one-tap next steps.
 * Opened from the evening notification (/dashboard?checkin=1) or the Home note. Nothing is saved
 * until you confirm in quick add.
 */
export function CheckInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const rules = useSettingsStore((s) => s.safeToSpendWallets)
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)
  const { inputs, loading, wallets } = useSafeToSpendInputs()
  const result = useMemo(() => (inputs ? safeToSpend(inputs) : null), [inputs])
  const [quickAdd, setQuickAdd] = useState<null | { kind: 'log' } | { kind: 'save'; from: string; to: string; amount: number }>(null)

  const spent = inputs?.spentToday ?? 0
  const left = result ? Math.round(result.leftToday) : 0

  // Where an unspent allowance could go: from the spending wallet with the most in it to a savings wallet.
  const move = useMemo(() => {
    const active = wallets.filter((w) => w.status !== 'archived')
    const from = active
      .filter((w) => walletCounts(w, rules?.[idOf(w)]))
      .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0))[0]
    const to = active.find((w) => w.type === 'savings' && !walletCounts(w, rules?.[idOf(w)]))
    return from && to ? { from, to } : null
  }, [wallets, rules])

  return (
    <>
      <Sheet open={open && !quickAdd} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="p-0 md:max-w-md" showCloseButton={false}>
          <div className="bg-card px-5 pb-6 pt-1 md:rounded-2xl">
            <SheetTitle className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Moon className="h-5 w-5 text-primary" />
              Evening check-in
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">A quick look at today before you sleep.</SheetDescription>

            {loading ? (
              <Skeleton className="mt-4 h-24 rounded-2xl" />
            ) : !result ? (
              <p className="mt-4 text-sm text-muted-foreground">Can&apos;t work out today&apos;s pace right now.</p>
            ) : (
              <div className="mt-4 rounded-2xl bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">
                  You spent <span className="font-semibold text-foreground">{money(spent)}</span> today out of{' '}
                  <span className="font-semibold text-foreground">{money(Math.round(result.perDay))}</span>.
                </p>
                <p className={`mt-1 font-heading text-xl font-bold ${result.short || left < 0 ? 'text-destructive' : 'text-success'}`}>
                  {result.short ? 'Bills before payday are more than your cash' : left >= 0 ? `${money(left)} under pace` : `${money(-left)} over pace`}
                </p>
                {!result.short && left < 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    That leaves {money(Math.max(0, Math.round(result.usable)))} until {result.nextIncomeDate ? 'payday' : 'month end'}.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setQuickAdd({ kind: 'log' })}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left text-sm font-semibold text-foreground hover:border-primary/50"
              >
                <Plus className="h-5 w-5 text-primary" />
                Log something I missed
              </button>
              {result && !result.short && left > 0 && move && (
                <button
                  type="button"
                  onClick={() => setQuickAdd({ kind: 'save', from: idOf(move.from), to: idOf(move.to), amount: left })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left text-sm font-semibold text-foreground hover:border-primary/50"
                >
                  <PiggyBank className="h-5 w-5 text-success" />
                  <span>
                    Move {money(left)} to {move.to.name}
                    <span className="block text-xs font-normal text-muted-foreground">From {move.from.name}. You check it before it saves.</span>
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center gap-3 rounded-2xl bg-primary p-3 text-left text-sm font-semibold text-primary-foreground"
              >
                <ThumbsUp className="h-5 w-5" />
                All good
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <QuickAddSheet
        open={!!quickAdd}
        onClose={() => setQuickAdd(null)}
        onSuccess={() => {
          setQuickAdd(null)
          onClose()
        }}
        title={quickAdd?.kind === 'save' ? 'Move to savings' : 'Add transaction'}
        initialType={quickAdd?.kind === 'save' ? 'transfer' : 'expense'}
        initialWalletId={quickAdd?.kind === 'save' ? quickAdd.from : undefined}
        initialData={quickAdd?.kind === 'save' ? { amount: quickAdd.amount, toWalletId: quickAdd.to, description: 'Unspent today' } : undefined}
      />
    </>
  )
}
