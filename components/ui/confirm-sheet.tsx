'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type ConfirmVariant = 'default' | 'destructive' | 'success'

const VARIANT_ICON: Record<ConfirmVariant, { icon: React.ReactNode; wrap: string }> = {
  default: {
    icon: <HelpCircle className="h-6 w-6" />,
    wrap: 'bg-primary/15 text-primary ring-4 ring-primary/10',
  },
  destructive: {
    icon: <AlertTriangle className="h-6 w-6" />,
    wrap: 'bg-destructive/15 text-destructive ring-4 ring-destructive/10',
  },
  success: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    wrap: 'bg-success/15 text-success ring-4 ring-success/10',
  },
}

interface ConfirmSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description?: string
  variant?: ConfirmVariant
  confirmLabel?: React.ReactNode
  cancelLabel?: string
  isConfirming?: boolean
  confirmingLabel?: React.ReactNode
  confirmDisabled?: boolean
  /** Extra content rendered between the header and the action buttons (a summary block, form fields, etc). */
  children?: React.ReactNode
}

/**
 * Shared confirmation surface for the whole app — a bottom sheet on mobile,
 * a small side panel on desktop (via the adaptive Sheet primitive). Covers
 * plain "are you sure?" confirmations as well as small confirm-with-a-form
 * flows (pass form fields as children and read their state in onConfirm).
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  variant = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isConfirming = false,
  confirmingLabel = 'Working...',
  confirmDisabled = false,
  children,
}: ConfirmSheetProps) {
  const { icon, wrap } = VARIANT_ICON[variant]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-b-0 pb-0">
          <div className="flex items-start gap-4">
            <div className={cn('shrink-0 rounded-full p-3', wrap)}>{icon}</div>
            <div className="space-y-1 pt-0.5">
              <SheetTitle>{title}</SheetTitle>
              {description && <SheetDescription>{description}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>

        {children && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 min-h-0">{children}</div>
        )}

        <SheetFooter className="border-t-0 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isConfirming || confirmDisabled}
          >
            {isConfirming ? confirmingLabel : confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
