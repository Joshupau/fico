'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { ListTransactionsParams } from '@/types/transaction'

export type Slice = {
  title: string
  subtitle?: string
  /** Inclusive start and exclusive end of the window. */
  start?: Date
  end?: Date
  type?: 'income' | 'expense'
  categoryId?: string
  walletId?: string
}

const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

/** The transactions behind one bar, day or category slice of a chart, with their total. */
export function SliceTransactionsSheet({ slice, onClose }: { slice: Slice | null; onClose: () => void }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (n: number) => formatMoney(n, currency, hideAmountsOnOpen)

  const params = useMemo<ListTransactionsParams | undefined>(() => {
    if (!slice) return undefined
    return {
      limit: '500',
      ...(slice.type ? { type: slice.type } : {}),
      ...(slice.categoryId ? { categoryId: slice.categoryId } : {}),
      ...(slice.walletId ? { walletId: slice.walletId } : {}),
      ...(slice.start ? { startDate: slice.start.toISOString() } : {}),
      // The list's end date is inclusive, so stop a millisecond before the next window.
      ...(slice.end ? { endDate: new Date(slice.end.getTime() - 1).toISOString() } : {}),
    }
  }, [slice])

  const { data, isLoading } = useListTransactions(params, !!params)
  // Charts count income and expenses only, so transfers are left out here too.
  const items = slice ? asList(data?.data).filter((t) => t.type !== 'transfer' && (!slice.type || t.type === slice.type)) : []
  const sumOf = (type: string) => items.reduce((sum, t) => sum + (t.type === type ? Number(t.amount) || 0 : 0), 0)
  const income = sumOf('income')
  const expenses = sumOf('expense')

  return (
    <Sheet open={!!slice} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="max-h-[85dvh] p-0 md:max-w-md" showCloseButton={false}>
        <div className="flex h-full min-h-0 flex-col bg-card md:rounded-2xl">
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-1">
            <div className="min-w-0">
              <SheetTitle className="truncate font-heading text-lg font-semibold text-foreground">{slice?.title}</SheetTitle>
              <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
                {slice?.subtitle}
                {!isLoading && ` · ${items.length} transaction${items.length === 1 ? '' : 's'}`}
              </SheetDescription>
            </div>
            {!isLoading &&
              (slice?.type ? (
                <p className="shrink-0 font-heading text-lg font-bold tabular-nums text-foreground">{money(slice.type === 'income' ? income : expenses)}</p>
              ) : (
                <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {(income > 0 || expenses === 0) && <p className="text-success">+{money(income)}</p>}
                  {expenses > 0 && <p className="text-destructive">-{money(expenses)}</p>}
                </div>
              ))}
          </div>

          <div data-vaul-no-drag className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-2xl" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((t) => (
                  <li key={String(t._id ?? t.id)} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        t.type === 'income' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{t.description || t.category?.name || 'Transaction'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {format(new Date(t.date), 'MMM d, h:mm a')}
                        {t.category?.name ? ` · ${t.category.name}` : ''}
                        {t.wallet?.name ? ` · ${t.wallet.name}` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                      {t.type === 'income' ? '+' : '-'}
                      {money(Number(t.amount) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
