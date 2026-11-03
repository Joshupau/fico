'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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
      {!asking && (
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
      )}

      {/* A centered dialog rather than a sheet: it is a quick yes/no, not a form. */}
      <Dialog open={asking} onOpenChange={(open) => !updating && setAsking(open)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[calc(100%-3rem)] gap-0 rounded-3xl border-border bg-card p-6 text-center sm:max-w-sm"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-4 ring-primary/10">
            <RefreshCw className="h-6 w-6" />
          </span>
          <DialogTitle className="mt-4 font-heading text-lg font-semibold text-foreground">Update Fico?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Fico will reload with the latest version. Your data stays as it is, and anything not yet synced is kept on this device. Anything
            you are typing right now will be lost.
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              disabled={updating}
              onClick={() => {
                setUpdating(true)
                applyUpdate()
              }}
            >
              {updating ? 'Updating...' : 'Update now'}
            </Button>
            <Button variant="outline" disabled={updating} onClick={() => setAsking(false)}>
              Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
