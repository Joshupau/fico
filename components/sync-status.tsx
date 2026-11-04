'use client'

import { useEffect } from 'react'
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { describeChange, SyncDetailsSheet, useSyncSheet } from '@/components/page/settings/sync-debug'
import { syncStatus, useSyncStatus } from '@/lib/local/status'

/**
 * Sync state at the top of the screen. Changes are saved on the device the moment they're made and
 * sync quietly behind the scenes, so a normal sync shows nothing. Changes still waiting (or being
 * offline) show a small dot; a pill appears only when the user should act: offline with unsent
 * changes, a change that couldn't sync, or a server that needs an update. Either opens Sync details.
 * Changes set aside are announced once as a toast.
 */
export function SyncStatusBadge() {
  return (
    <>
      <Badge />
      <SyncDetailsSheet />
    </>
  )
}

function Badge() {
  const { active, preparing, progress, copyLost, online, pending, stalled, syncing, failures, error, dead, serverNeedsUpdate } = useSyncStatus()
  const openSheet = () => useSyncSheet.getState().setOpen(true)

  useEffect(() => {
    if (failures.length === 0) return
    for (const f of failures) toast.error(`Couldn’t sync a change (${describeChange(f.what)}): ${f.message}. It’s kept on this device; see Settings, Sync details.`, { duration: 8000 })
    syncStatus.dismissFailures()
  }, [failures])

  if (!active) {
    // Before the offline copy is ready the app works from the server; say so only when it matters.
    // A first download that failed while online says so too (tap for the reason), or it would quietly
    // start over on every launch.
    const step = progress && progress.done > 0 ? ` ${progress.done}/${progress.total}` : ''
    const note = preparing
      ? copyLost
        ? `This device cleared its offline copy · saving it again…${step}`
        : `Saving your data for offline use…${step}`
      : error
        ? online
          ? 'Couldn’t save your data for offline use'
          : 'Offline · your data isn’t saved on this device yet'
        : null
    if (!note) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <button
          type="button"
          onClick={() => !preparing && error && toast.error(error, { duration: 7000 })}
          disabled={preparing}
          className={`${preparing ? 'pointer-events-none' : 'pointer-events-auto'} flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-ios`}
        >
          {preparing ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> : <CloudOff className="h-3.5 w-3.5 text-warning" />}
          {note}
        </button>
      </div>
    )
  }
  // Normal background syncing shows nothing. Changes still waiting get a small dot; the full pill is
  // only for something the user should know or do.
  const needsAction = dead > 0 || serverNeedsUpdate || (!online && pending > 0)
  if (!needsAction) {
    const waiting = pending > 0 && stalled
    if (!waiting && online) return null
    return (
      <>
        <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}>
          <button
            type="button"
            onClick={openSheet}
            aria-label={online ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : 'Offline'}
            className="pointer-events-auto flex size-6 items-center justify-center rounded-full"
          >
            <span className={`size-2 rounded-full ${online ? 'bg-warning' : 'bg-muted-foreground/60'} ${syncing ? 'animate-pulse' : ''}`} />
          </button>
        </div>
        </>
    )
  }

  const label =
    dead > 0
      ? `${dead} change${dead === 1 ? '' : 's'} couldn’t sync · Review`
      : serverNeedsUpdate
        ? 'Server update needed · changes saved here'
        : `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on this device`
  const icon = !online ? (
    <CloudOff className="h-3.5 w-3.5 text-warning" />
  ) : (
    <AlertTriangle className={`h-3.5 w-3.5 ${dead > 0 ? 'text-destructive' : 'text-warning'}`} />
  )

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <button
          type="button"
          onClick={openSheet}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-ios"
        >
          {icon}
          {label}
        </button>
      </div>
    </>
  )
}
