'use client'

import { useMemo, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, PeacockMascot } from '@/components/peacock-mascot'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { WishlistItemCard } from '@/components/page/wishlist/wishlist-item-card'
import { WishlistItemSheet } from '@/components/page/wishlist/wishlist-item-sheet'
import { useDeleteWishlistItem, useListWishlist, useSetWishlistBought } from '@/queries/user/wishlist/wishlist'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { Skeleton } from '@/components/ui/skeleton'
import type { WishlistItem, WishlistPriority, WishlistStatus } from '@/types/wishlist'

const TABS: { value: WishlistStatus; label: string }[] = [
  { value: 'wanted', label: 'Wanted' },
  { value: 'bought', label: 'Bought' },
]

const ORDER: Record<WishlistPriority, number> = { need: 0, want: 1, someday: 2 }
const DAYS_PER_MONTH = 365.25 / 12

const localToday = () => format(new Date(), 'yyyy-MM-dd')

/** What to put aside each month to have the price by the item's date. Under a month left means all of it now. */
const monthlyFor = (item: WishlistItem, today: string) => {
  if (!item.targetDate) return 0
  const months = Math.max(0, differenceInCalendarDays(parseISO(item.targetDate), parseISO(today))) / DAYS_PER_MONTH
  return item.price / Math.max(1, months)
}

export default function WishlistPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const [tab, setTab] = useState<WishlistStatus>('wanted')
  const [sheet, setSheet] = useState<{ open: boolean; item: WishlistItem | null }>({ open: false, item: null })
  const [deleting, setDeleting] = useState<WishlistItem | null>(null)

  const { data, isLoading } = useListWishlist()
  const { mutate: remove, isPending: removing } = useDeleteWishlistItem()
  const { mutate: setBought } = useSetWishlistBought()

  const all = useMemo(() => data ?? [], [data])
  const today = localToday()
  const wanted = useMemo(
    () =>
      all
        .filter((i) => i.status === 'wanted')
        .sort((a, b) => ORDER[a.priority] - ORDER[b.priority] || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')),
    [all]
  )
  const bought = useMemo(() => all.filter((i) => i.status === 'bought').sort((a, b) => (b.boughtOn ?? '').localeCompare(a.boughtOn ?? '')), [all])
  const items = tab === 'wanted' ? wanted : bought

  const totals = useMemo(() => {
    const sum = (list: WishlistItem[]) => list.reduce((s, i) => s + i.price, 0)
    return {
      wanted: sum(wanted),
      need: sum(wanted.filter((i) => i.priority === 'need')),
      needCount: wanted.filter((i) => i.priority === 'need').length,
      monthly: wanted.reduce((s, i) => s + monthlyFor(i, today), 0),
      dated: wanted.filter((i) => i.targetDate).length,
    }
  }, [wanted, today])

  const money = (value: number) => formatMoney(value, currency, !showAmounts)

  const note = (() => {
    if (isLoading) return ''
    if (all.length === 0) return 'Add the things you want to buy, with a price. I will keep them in mind when we plan your money.'
    if (wanted.length === 0) return 'You got everything on your list. Add the next thing you have your eye on.'
    const top = wanted[0]
    const late = wanted.find((i) => i.targetDate && i.targetDate < today)
    if (late) return `${late.name} was wanted by ${format(parseISO(late.targetDate!), 'MMM d')}. Pick a new date or mark it bought.`
    if (top.priority === 'need') return `Top of the list: ${top.name}, ${money(top.price)}. Check Safe to spend before you buy it.`
    return `${wanted.length} thing${wanted.length === 1 ? '' : 's'} on your list. Nothing marked as a need, so there is no rush.`
  })()

  const openNew = () => setSheet({ open: true, item: null })
  const openEdit = (item: WishlistItem) => setSheet({ open: true, item })

  const toggleBought = (item: WishlistItem) => {
    const nowBought = item.status !== 'bought'
    setBought(
      { id: item.id, boughtOn: nowBought ? today : null },
      { onSuccess: () => toast.success(nowBought ? 'Marked as bought. Log it as an expense when you pay.' : 'Back on your wishlist') }
    )
  }

  const confirmDelete = () => {
    if (!deleting) return
    remove({ id: deleting.id }, { onSuccess: () => { toast.success('Deleted'); setDeleting(null) } })
  }

  const tiles = [
    { label: 'Needs', value: money(totals.need), hint: `${totals.needCount} item${totals.needCount === 1 ? '' : 's'}` },
    { label: 'Set aside monthly', value: money(totals.monthly), hint: totals.dated ? `for ${totals.dated} with a date` : 'add a date to see this' },
  ]

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Things you want</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Wishlist</h1>
          </div>

          <section className="mt-5">
            <div className="relative z-10 mb-3 flex items-end">
              <div className="relative min-w-0 max-w-2xl flex-1 rounded-[1.75rem] border border-border bg-card px-4 py-3.5 shadow-ios">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fico&apos;s take
                </p>
                {isLoading ? (
                  <div className="mt-2 space-y-2" aria-label="Loading">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{note}</p>
                )}
                <span aria-hidden="true" className="absolute -right-3.5 bottom-6 h-3.5 w-3.5 rounded-full border border-border bg-card shadow-sm sm:bottom-8" />
                <span aria-hidden="true" className="absolute -right-[1.65rem] bottom-4 h-2 w-2 rounded-full border border-border bg-card shadow-sm sm:bottom-6" />
              </div>
              <PeacockMascot pose="advisor" className="-mb-10 ml-7 h-24 w-24 shrink-0 sm:h-28 sm:w-28" label="Fico, your financial advisor" />
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#004C99] px-5 pb-5 pt-9 text-white shadow-ios-lg">
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/75">Still to buy</p>
                    <button
                      type="button"
                      onClick={() => setShowAmounts((v) => !v)}
                      aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
                      className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white"
                    >
                      {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={openNew}
                    className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                {isLoading ? (
                  <Skeleton className="mt-2 h-10 w-52 bg-white/20 sm:h-12" />
                ) : (
                  <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(totals.wanted)}</p>
                )}
                <p className="mt-1 text-xs text-white/75">
                  {wanted.length} item{wanted.length === 1 ? '' : 's'} on your list{bought.length ? `, ${bought.length} bought` : ''}.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="min-w-0 rounded-2xl bg-white/12 p-3">
                      <p className="text-xs font-medium text-white/75">{tile.label}</p>
                      <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{isLoading ? <Skeleton className="h-6 w-20 bg-white/20" /> : tile.value}</div>
                      {!isLoading && <p className="truncate text-xs text-white/75">{tile.hint}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div role="group" aria-label="Filter" className="mt-5 inline-flex rounded-full bg-secondary p-1">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => setTab(option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${tab === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-36 animate-pulse rounded-3xl bg-secondary" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-10 shadow-ios">
                {tab === 'wanted' ? (
                  <EmptyState pose="advisor" title="Your wishlist is empty" description="Add a phone, shoes, a trip or anything you are saving up for, with its price.">
                    <button type="button" onClick={openNew} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                      <Plus className="h-4 w-4" />
                      Add one
                    </button>
                  </EmptyState>
                ) : (
                  <EmptyState pose="advisor" title="Nothing bought yet" description="When you buy something from your list, mark it as bought and it moves here." />
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <WishlistItemCard key={item.id} item={item} hideAmounts={!showAmounts} onEdit={openEdit} onToggleBought={toggleBought} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </div>
        </main>
      </IonContent>

      <WishlistItemSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} item={sheet.item} />
      <ConfirmSheet
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(null)}
        onConfirm={confirmDelete}
        variant="destructive"
        title="Delete this wish?"
        description={deleting ? `${deleting.name} will be removed from your wishlist.` : undefined}
        confirmLabel="Delete"
        confirmingLabel="Deleting..."
        isConfirming={removing}
      />
    </IonPage>
  )
}
