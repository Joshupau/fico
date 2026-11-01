'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const UNCATEGORIZED = 'none'

interface CategoryOption {
  id: string
  name: string
  icon?: string
}

interface DeleteCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (replacementId: string | null) => void
  categoryName: string
  transactionCount: number
  /** Active categories of the same type that can take over its transactions. */
  replacements: CategoryOption[]
  isDeleting?: boolean
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  onConfirm,
  categoryName,
  transactionCount,
  replacements,
  isDeleting,
}: DeleteCategoryDialogProps) {
  const [replacementId, setReplacementId] = useState(UNCATEGORIZED)

  useEffect(() => {
    if (open) setReplacementId(UNCATEGORIZED)
  }, [open])

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => onConfirm(replacementId === UNCATEGORIZED ? null : replacementId)}
      variant="destructive"
      title="Delete Category?"
      description="This can't be undone. To keep it on past transactions instead, archive it."
      confirmLabel={
        <span className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Delete Category
        </span>
      }
      confirmingLabel="Deleting..."
      isConfirming={isDeleting}
    >
      <div className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Category</span>
          <span className="max-w-[200px] truncate font-semibold text-foreground">{categoryName}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Transactions</span>
          <span className="font-semibold text-foreground">{transactionCount}</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Move its transactions, bills and budgets to</label>
        <Select value={replacementId} onValueChange={setReplacementId}>
          <SelectTrigger className="bg-secondary/30 w-full">
            <SelectValue placeholder="Uncategorized" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
            {replacements.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A budget that only tracks {categoryName} is archived if nothing takes its place.
        </p>
      </div>
    </ConfirmSheet>
  )
}
