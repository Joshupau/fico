'use client'

import { Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'

interface DeleteBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  billName: string
  isDeleting?: boolean
}

export function DeleteBillDialog({
  open,
  onOpenChange,
  onConfirm,
  billName,
  isDeleting,
}: DeleteBillDialogProps) {
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      variant="destructive"
      title="Archive Bill?"
      description="This action will remove the bill from your active ledger."
      confirmLabel={
        <span className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Archive Bill
        </span>
      }
      confirmingLabel="Removing..."
      isConfirming={isDeleting}
    >
      <div className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Bill Name</span>
          <span className="max-w-[200px] truncate font-semibold text-foreground">{billName}</span>
        </div>
      </div>
    </ConfirmSheet>
  )
}
