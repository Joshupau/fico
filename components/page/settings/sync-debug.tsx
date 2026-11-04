'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'
import { create } from 'zustand'
import { AlertTriangle, CheckCircle2, ClipboardCopy, CloudOff, RefreshCw, RotateCcw, ScanSearch, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { discardSetAside, fullSyncCheck, retrySetAside, syncDetails, syncNow } from '@/lib/local/client'
import { useSyncStatus } from '@/lib/local/status'
import type { QueuedChange, SyncDetails } from '@/lib/local/sync'
import { cn } from '@/lib/utils'

/** Opens Sync details from anywhere: the Settings row, or the sync badge at the top of the screen. */
export const useSyncSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

const VERBS: Record<string, string> = {
  create: 'Add',
  update: 'Edit',
  delete: 'Delete',
  insert: 'Add',
  upsert: 'Save',
  mark_paid: 'Mark paid',
  archive: 'Archive',
}

/** "transactions_create" -> "Add transactions", "update wallets" -> "Edit wallets". */
export function describeChange(what: string): string {
  const table = what.match(/^(insert|update|upsert|delete) (.+)$/)
  if (table) return `${VERBS[table[1]]} ${table[2].replace(/_/g, ' ')}`
  const verb = Object.keys(VERBS).find((v) => what.endsWith(`_${v}`))
  if (verb) return `${VERBS[verb]} ${what.slice(0, -verb.length - 1).replace(/_/g, ' ')}`
  return what.replace(/_/g, ' ')
}

const ago = (at: number | string | null | undefined) => (at ? `${formatDistanceToNowStrict(new Date(at))} ago` : 'never')

/** A plain-text summary to paste into a bug report: change names, counts and errors, never row data. */
function report(d: SyncDetails, online: boolean): string {
  const lines = [
    `Fico sync report, ${new Date().toISOString()}`,
    `Online: ${online ? 'yes' : 'no'}`,
    `Waiting: ${d.pending}, set aside: ${d.dead}`,
    `Last sync: ${d.lastSyncedAt ? new Date(d.lastSyncedAt).toISOString() : 'never'}`,
    `Last full check: ${d.lastFullCheckAt ? new Date(d.lastFullCheckAt).toISOString() : 'never'}`,
    `Next try: ${d.retryAt ? new Date(d.retryAt).toISOString() : 'now'}`,
    `Server needs update: ${d.serverNeedsUpdate ? 'yes' : 'no'}`,
    `Tables the server lacks: ${d.missing.join(', ') || 'none'}`,
    `Tables refreshing: ${d.refreshing.join(', ') || 'none'}`,
    `Last error: ${d.error ?? 'none'}`,
    '',
    'Changes:',
    ...d.changes.map((c) => `- #${c.seq} ${c.what} [${c.status}] tries ${c.attempts}, queued ${c.createdAt}${c.lastError ? `, error: ${c.lastError}` : ''}`),
  ]
  return lines.join('\n')
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'success' }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-foreground')}>{value}</p>
    </div>
  )
}

function ChangeRow({ change, onRetry, onDiscard, busy }: { change: QueuedChange; onRetry: () => void; onDiscard: () => void; busy: boolean }) {
  const dead = change.status === 'dead'
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl', dead ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning')}>
          {dead ? <AlertTriangle className="size-4" /> : <RefreshCw className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-tight text-foreground">{describeChange(change.what)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dead ? 'Couldn’t sync' : 'Waiting'} · made {ago(change.createdAt)}
            {change.attempts > 0 ? ` · ${change.attempts} ${change.attempts === 1 ? 'try' : 'tries'}` : ''}
          </p>
          {change.lastError && <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">{change.lastError}</p>}
        </div>
      </div>
      {dead && (
        <div className="mt-2.5 flex gap-2 pl-11">
          <Button size="sm" variant="secondary" className="rounded-full" disabled={busy} onClick={onRetry}>
            <RotateCcw className="size-3.5" /> Retry
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive" disabled={busy} onClick={onDiscard}>
            <Trash2 className="size-3.5" /> Discard
          </Button>
        </div>
      )}
    </li>
  )
}

/** Settings > Sync details: what is waiting to sync and why, with Retry and Discard for changes set aside. */
export function SyncDetailsSheet() {
  const { open, setOpen } = useSyncSheet()
  const status = useSyncStatus()
  const [details, setDetails] = useState<SyncDetails | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setDetails(await syncDetails().catch(() => null))
    setLoaded(true)
  }, [])

  // Reload whenever the sync state moves while the sheet is open.
  useEffect(() => {
    if (!open) return
    let live = true
    syncDetails()
      .catch(() => null)
      .then((d) => {
        if (!live) return
        setDetails(d)
        setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [open, status.pending, status.dead, status.syncing, status.lastSyncedAt])

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      if (done) toast.success(done)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
      await load()
    }
  }

  const copy = async () => {
    if (!details) return
    try {
      await navigator.clipboard.writeText(report(details, status.online))
      toast.success('Sync report copied')
    } catch {
      toast.error('Couldn’t copy the report')
    }
  }

  const allClear = details && details.pending === 0 && details.dead === 0
  const headline = !details
    ? null
    : !status.online
      ? { icon: <CloudOff className="size-5" />, tone: 'bg-warning/15 text-warning', text: 'Offline. Changes are saved on this device and sync when you’re back.' }
      : details.serverNeedsUpdate
        ? { icon: <AlertTriangle className="size-5" />, tone: 'bg-warning/15 text-warning', text: 'The server needs an update before changes can sync. They’re safe on this device.' }
        : details.dead > 0
          ? { icon: <AlertTriangle className="size-5" />, tone: 'bg-destructive/10 text-destructive', text: `${details.dead} change${details.dead === 1 ? '' : 's'} couldn’t sync. Retry, or discard to keep what the server has.` }
          : details.missing.length > 0 && details.pending > 0
            ? { icon: <AlertTriangle className="size-5" />, tone: 'bg-warning/15 text-warning', text: 'Some changes wait for a server update (the tables listed below). They’re safe on this device and sync once the server has them.' }
          : details.retryAt
            ? { icon: <RefreshCw className="size-5" />, tone: 'bg-warning/15 text-warning', text: `The server had trouble with a change. Trying again in ${formatDistanceToNowStrict(new Date(details.retryAt))}.` }
            : allClear
              ? { icon: <CheckCircle2 className="size-5" />, tone: 'bg-success/15 text-success', text: 'Everything on this device is on the server.' }
              : { icon: <RefreshCw className="size-5" />, tone: 'bg-primary/10 text-primary', text: 'Changes are on their way to the server.' }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="max-h-[90dvh] p-0 sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-b-0 pb-2">
          <SheetTitle>Sync details</SheetTitle>
          <SheetDescription>What this device still has to send, and why.</SheetDescription>
        </SheetHeader>
        <div data-vaul-no-drag className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          {loaded && !details && (
            <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">This device isn’t keeping an offline copy right now, so everything goes straight to the server.</p>
          )}
          {details && headline && (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-ios">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', headline.tone)}>{headline.icon}</span>
                <p className="pt-1.5 text-sm leading-snug text-foreground">{headline.text}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Stat label="Waiting" value={String(details.pending)} tone={details.pending ? 'warning' : undefined} />
                <Stat label="Couldn’t sync" value={String(details.dead)} tone={details.dead ? 'warning' : undefined} />
                <Stat label="Last sync" value={ago(details.lastSyncedAt)} />
                <Stat label="Full check" value={ago(details.lastFullCheckAt)} />
              </div>

              {details.changes.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Changes on this device</h3>
                    {details.dead > 1 && (
                      <button type="button" disabled={busy} onClick={() => act(() => retrySetAside(), 'Trying again')} className="text-xs font-semibold text-primary">
                        Retry all
                      </button>
                    )}
                  </div>
                  <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-ios">
                    {details.changes.map((c) => (
                      <ChangeRow
                        key={c.seq}
                        change={c}
                        busy={busy}
                        onRetry={() => act(() => retrySetAside(c.seq), 'Trying again')}
                        onDiscard={() => act(() => discardSetAside(c.seq), 'Change discarded')}
                      />
                    ))}
                  </ul>
                  {details.pending + details.dead > details.changes.length && (
                    <p className="mt-2 px-1 text-xs text-muted-foreground">and {details.pending + details.dead - details.changes.length} more</p>
                  )}
                </section>
              )}

              {(details.missing.length > 0 || details.refreshing.length > 0 || details.error) && (
                <section className="space-y-1.5 rounded-2xl bg-secondary/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {details.missing.length > 0 && <p>Not on the server yet: {details.missing.join(', ')}. Changes to these wait on this device.</p>}
                  {details.refreshing.length > 0 && <p>Downloading again after the app update: {details.refreshing.join(', ')}.</p>}
                  {details.error && <p>Last problem: {details.error}</p>}
                </section>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-11 rounded-2xl" disabled={busy || !status.online} onClick={() => act(syncNow)}>
                  <RefreshCw className={cn('size-4', status.syncing && 'animate-spin')} /> Sync now
                </Button>
                <Button variant="secondary" className="h-11 rounded-2xl" disabled={busy || !status.online} onClick={() => act(fullSyncCheck, 'Checked every table')}>
                  <ScanSearch className="size-4" /> Full check
                </Button>
              </div>
              <Button variant="ghost" className="h-10 w-full rounded-2xl text-muted-foreground" onClick={copy}>
                <ClipboardCopy className="size-4" /> Copy report
              </Button>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">The report has change names, counts and error messages. It never includes the transactions or amounts themselves.</p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
