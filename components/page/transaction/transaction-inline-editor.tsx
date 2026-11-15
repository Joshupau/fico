'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TransactionItem } from './transaction-list'
import { UpdateTransactionData } from '@/types/transaction'

interface TransactionInlineEditorProps {
  transaction: TransactionItem
  onSave: (data: UpdateTransactionData) => void
  onCancel: () => void
  isSaving?: boolean
}

type InlineDraft = {
  amount: string
  description: string
  status: TransactionItem['status']
}

export function TransactionInlineEditor({ transaction, onSave, onCancel, isSaving }: TransactionInlineEditorProps) {
  const initialDraft = useMemo<InlineDraft>(
    () => ({
      amount: String(transaction.amount ?? ''),
      description: transaction.description ?? '',
      status: transaction.status,
    }),
    [transaction.id, transaction.amount, transaction.description, transaction.status]
  )

  const [draft, setDraft] = useState<InlineDraft>(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    onSave({
      id: transaction.id,
      amount,
      description: draft.description.trim() || undefined,
      status: draft.status,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-border bg-background/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Editing transaction</p>
          <p className="text-xs text-muted-foreground">Update the fields that can be saved inline.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Cancel inline edit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Status</label>
          <Select value={draft.status} onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as InlineDraft['status'] }))}>
            <SelectTrigger className="bg-secondary/30">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor={`amount-${transaction.id}`} className="text-xs font-medium text-foreground">Amount</label>
          <Input
            id={`amount-${transaction.id}`}
            type="number"
            step="0.01"
            min="0"
            value={draft.amount}
            onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
            className="bg-secondary/30"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label htmlFor={`description-${transaction.id}`} className="text-xs font-medium text-foreground">Description</label>
        <textarea
          id={`description-${transaction.id}`}
          value={draft.description}
          onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground outline-none transition-ui focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-2">
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Save changes</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
