'use client'

import { Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { TransactionItem } from './transaction-list'

interface DeleteTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  transaction: TransactionItem | null
  isDeleting?: boolean
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  transaction,
  isDeleting,
}: DeleteTransactionDialogProps) {
  if (!transaction) return null

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      variant="destructive"
      title="Delete Transaction?"
      description="This will permanently remove the transaction from your ledger."
      confirmLabel={
        <span className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Delete Transaction
        </span>
      }
      confirmingLabel="Deleting..."
      isConfirming={isDeleting}
    >
      <div className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Title</span>
          <span className="max-w-[220px] truncate font-semibold text-foreground">{transaction.title}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold text-foreground">{transaction.amount}</span>
        </div>
      </div>
    </ConfirmSheet>
  )
}
