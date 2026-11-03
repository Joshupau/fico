'use client'

import { useState } from 'react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import { CheckCircle2, ExternalLink, Gift, MoreHorizontal, Pencil, RotateCcw, ShoppingBag, Sparkles, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { WishlistItem, WishlistPriority } from '@/types/wishlist'

interface WishlistItemCardProps {
  item: WishlistItem
  hideAmounts: boolean
  onEdit: (item: WishlistItem) => void
  onToggleBought: (item: WishlistItem) => void
  onDelete: (item: WishlistItem) => void
}

export const PRIORITIES: { value: WishlistPriority; label: string; tone: string }[] = [
  { value: 'need', label: 'Need it', tone: 'bg-warning/15 text-warning' },
  { value: 'want', label: 'Want it', tone: 'bg-primary/10 text-primary' },
  { value: 'someday', label: 'Someday', tone: 'bg-secondary text-muted-foreground' },
]

const ICONS = { need: ShoppingBag, want: Gift, someday: Sparkles }

/** Only plain web links are shown as links. */
export const safeUrl = (url?: string | null) => (url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null)

export function WishlistItemCard({ item, hideAmounts, onEdit, onToggleBought, onDelete }: WishlistItemCardProps) {
  const { currency } = useSettingsStore()
  const [menu, setMenu] = useState(false)
  const bought = item.status === 'bought'
  const priority = PRIORITIES.find((p) => p.value === item.priority) ?? PRIORITIES[1]
  const Icon = bought ? CheckCircle2 : ICONS[item.priority] ?? Gift
  const link = safeUrl(item.url)

  let when = ''
  let late = false
  if (bought) {
    when = item.boughtOn ? `Bought ${format(parseISO(item.boughtOn), 'MMM d, yyyy')}` : 'Bought'
  } else if (item.targetDate) {
    const days = differenceInCalendarDays(parseISO(item.targetDate), new Date())
    late = days < 0
    when = days === 0 ? 'Want it today' : days === 1 ? 'Want it tomorrow' : !late && days <= 7 ? `Want it in ${days} days` : `Want it by ${format(parseISO(item.targetDate), 'MMM d, yyyy')}`
  }

  return (
    <article className={`min-w-0 rounded-3xl border border-border bg-card p-4 shadow-ios ${bought ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${bought ? 'bg-success/15 text-success' : priority.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline">
              <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/i, '')}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{bought ? 'Bought' : priority.label}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${bought ? 'bg-success/15 text-success' : priority.tone}`}>
          {bought ? 'Bought' : priority.label}
        </span>
        <div className="relative -mr-1">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`${item.name} actions`} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-ios-lg">
                <button type="button" onClick={() => { setMenu(false); onToggleBought(item) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  {bought ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {bought ? 'Move back to wishlist' : 'Mark as bought'}
                </button>
                <button type="button" onClick={() => { setMenu(false); onEdit(item) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => { setMenu(false); onDelete(item) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price</p>
          <p className="truncate font-heading text-xl font-bold tabular-nums text-foreground">{formatMoney(item.price, currency, hideAmounts)}</p>
        </div>
        {when && <p className={`shrink-0 pb-1 text-xs tabular-nums ${late ? 'text-warning' : 'text-muted-foreground'}`}>{when}</p>}
      </div>

      {item.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>}
    </article>
  )
}
