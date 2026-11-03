'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { chipClass, Field, FormSheet, fieldClass, MoneyField, scrollRowClass } from '@/components/ui/form-sheet'
import { useCreateWishlistItem, useUpdateWishlistItem } from '@/queries/user/wishlist/wishlist'
import { PRIORITIES } from '@/components/page/wishlist/wishlist-item-card'
import type { WishlistItem, WishlistPriority } from '@/types/wishlist'

interface WishlistItemSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this item instead of creating one. */
  item?: WishlistItem | null
}

export function WishlistItemSheet({ open, onClose, item }: WishlistItemSheetProps) {
  const { mutate: create, isPending: creating } = useCreateWishlistItem()
  const { mutate: update, isPending: updating } = useUpdateWishlistItem()
  const isEdit = !!item

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [priority, setPriority] = useState<WishlistPriority>('want')
  const [targetDate, setTargetDate] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setPrice(item ? String(item.price) : '')
    setPriority(item?.priority ?? 'want')
    setTargetDate(item?.targetDate ?? '')
    setUrl(item?.url ?? '')
    setNotes(item?.notes ?? '')
  }, [open, item])

  const finish = (message: string) => {
    toast.success(message)
    onClose()
  }

  const submit = () => {
    if (!name.trim()) return void toast.error('Give it a name')
    const priceNum = Number(price) || 0
    if (priceNum <= 0) return void toast.error('Enter the price')
    let link = url.trim()
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`

    const data = {
      name: name.trim(),
      price: priceNum,
      priority,
      targetDate: targetDate || null,
      url: link || null,
      notes: notes.trim() || null,
    }
    if (isEdit && item) update({ id: item.id, ...data }, { onSuccess: () => finish('Saved') })
    else create(data, { onSuccess: () => finish('Added to your wishlist') })
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit wish' : 'Add to wishlist'}
      description="Something you want to buy, what it costs and how much you want it."
      submitLabel={isEdit ? 'Save changes' : 'Add to wishlist'}
      onSubmit={submit}
      busy={creating || updating}
    >
      <Field label="What is it">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New phone" aria-label="Name" className={fieldClass} />
      </Field>

      <Field label="Price">
        <MoneyField value={price} onChange={setPrice} ariaLabel="Price" />
      </Field>

      <Field label="How much do you want it">
        <div className={scrollRowClass} role="group" aria-label="Priority">
          {PRIORITIES.map((p) => (
            <button key={p.value} type="button" aria-pressed={priority === p.value} onClick={() => setPriority(p.value)} className={chipClass(priority === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Want it by (optional)" hint="Fico shows how much to set aside each month.">
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="Want it by" className={fieldClass} />
      </Field>

      <Field label="Link (optional)">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="shopee.ph/..." inputMode="url" aria-label="Link" className={fieldClass} />
      </Field>

      <Field label="Note (optional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, size, wait for a sale" aria-label="Note" className={fieldClass} />
      </Field>
    </FormSheet>
  )
}
