'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { applyUpdate, onUpdateReady } from '@/utils/register-sw'

/**
 * Shown when a new version of Fico has been downloaded. Nothing reloads by itself: tapping the bar
 * asks first, and "Later" hides it until the app is next opened.
 */
export function UpdateBar() {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [asking, setAsking] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => onUpdateReady(setReady), [])

  if (!ready || dismissed) return null

  return (
    <>
      <div
        role="status"
        className="fixed left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 py-1.5 pl-4 pr-1.5 shadow-ios-lg backdrop-blur">
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">A new version of Fico is ready</p>
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Update
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Hide until next time"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={asking}
        onOpenChange={setAsking}
        title="Update Fico?"
        description="Fico will reload with the latest version. Your data stays as it is, and anything not yet synced is kept on this device. Anything you are typing right now will be lost."
        confirmLabel="Update now"
        cancelLabel="Later"
        isConfirming={updating}
        confirmingLabel="Updating..."
        onConfirm={() => {
          setUpdating(true)
          applyUpdate()
        }}
      />
    </>
  )
}
