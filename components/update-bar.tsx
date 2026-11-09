'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { applyUpdate, onUpdateReady } from '@/utils/register-sw'

/**
 * Shown when a new version of Fico has been downloaded. Nothing reloads by itself: tapping the bar
 * asks first, and "Later" hides it until the app is next opened.
 */

// Reloading takes well under a second, which looks like the app just blinked. A short progress bar
// makes the update visible: it eases toward 90%, the real switch starts partway through, and the bar
// fills right before the reload.
const START_SWITCH_AFTER_MS = 1200
const TICK_MS = 40
export function UpdateBar() {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [asking, setAsking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => onUpdateReady(setReady), [])
  useEffect(() => () => timers.current.forEach((id) => window.clearInterval(id)), [])

  const startUpdate = () => {
    setUpdating(true)
    setProgress(4)
    const tick = window.setInterval(() => setProgress((value) => Math.min(90, value + (92 - value) * 0.05)), TICK_MS)
    const start = window.setTimeout(() => {
      applyUpdate(() => {
        window.clearInterval(tick)
        setProgress(100)
      })
    }, START_SWITCH_AFTER_MS)
    timers.current.push(tick, start)
  }

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
            {updating
              ? 'Installing the latest version. Fico will reopen in a moment.'
              : 'Fico will reload with the latest version. Your data stays as it is, and anything not yet synced is kept on this device. Anything you are typing right now will be lost.'}
          </DialogDescription>
          {updating ? (
            <div className="mt-6">
              <div
                role="progressbar"
                aria-label="Updating Fico"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="h-2 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {progress >= 100 ? 'Done, reopening...' : `Updating... ${Math.round(progress)}%`}
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={startUpdate}>Update now</Button>
              <Button variant="outline" onClick={() => setAsking(false)}>
                Later
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
