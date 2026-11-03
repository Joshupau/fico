'use client'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useSettingsStore } from '@/store/settings-store'
import { walletCounts } from '@/utils/safe-to-spend'

const idOf = (w: any) => String(w._id ?? w.id ?? '')
const toNumber = (text: string) => {
  const n = Number(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Which wallets are spending money, the minimum to leave in each, and an extra amount kept aside. */
export function SafeToSpendWalletsSheet({
  open,
  onClose,
  wallets,
  money,
}: {
  open: boolean
  onClose: () => void
  wallets: any[]
  money: (n: number) => string
}) {
  const rules = useSettingsStore((s) => s.safeToSpendWallets)
  const setRule = useSettingsStore((s) => s.setSafeToSpendWallet)
  const floor = useSettingsStore((s) => s.safeToSpendFloor)
  const setFloor = useSettingsStore((s) => s.setSafeToSpendFloor)
  const list = wallets.filter((w) => w.status !== 'archived' && w.type !== 'credit_card')

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[94dvh] p-0 md:max-h-none md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="px-5 pb-2 pt-1">
            <SheetTitle className="font-heading text-lg font-semibold text-foreground">Spending wallets</SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              Turn off wallets you save in. For a bank with a maintaining balance, set the minimum to leave in it.
            </SheetDescription>
          </div>

          <ul data-vaul-no-drag className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
            {list.map((wallet) => {
              const id = idOf(wallet)
              const rule = rules?.[id]
              const on = walletCounts(wallet, rule)
              return (
                <li key={id} className="rounded-2xl border border-border bg-secondary/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`Count ${wallet.name}`}
                      onClick={() => setRule(id, { include: !on })}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{wallet.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {money(Number(wallet.balance) || 0)}
                        {wallet.type === 'savings' ? ' · Savings' : ''}
                      </span>
                    </span>
                    {on && (
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        Min
                        <input
                          inputMode="decimal"
                          aria-label={`Minimum to leave in ${wallet.name}`}
                          defaultValue={rule?.min ? String(rule.min) : ''}
                          placeholder="0"
                          onBlur={(e) => setRule(id, { min: toNumber(e.target.value) })}
                          className="w-20 rounded-xl border border-border bg-background px-2.5 py-1.5 text-right text-sm tabular-nums text-foreground outline-none focus:border-primary"
                        />
                      </label>
                    )}
                  </div>
                </li>
              )
            })}
            <li className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 p-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Also keep aside</span>
                <span className="block text-xs text-muted-foreground">An extra cushion, not tied to a wallet</span>
              </span>
              <input
                inputMode="decimal"
                aria-label="Also keep aside"
                defaultValue={floor > 0 ? String(floor) : ''}
                placeholder="0"
                onBlur={(e) => setFloor(toNumber(e.target.value))}
                className="w-24 rounded-xl border border-border bg-background px-2.5 py-1.5 text-right text-sm tabular-nums text-foreground outline-none focus:border-primary"
              />
            </li>
          </ul>

          <div data-vaul-no-drag className="flex shrink-0 gap-2 border-t border-border px-4 pb-4 pt-3">
            <button
              type="button"
              // Blur first so a minimum still being typed is saved.
              onClick={() => {
                ;(document.activeElement as HTMLElement | null)?.blur()
                onClose()
              }}
              className="h-12 flex-1 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-ios"
            >
              Done
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
