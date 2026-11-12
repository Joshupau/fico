'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { findingTitle, statusLabel, type ReconcileCheck } from '@/utils/import-reconcile'
import { formatAmount, parseAmount, type Finding, type Fix } from '@/utils/ledgerlens'

export type Decisions = Record<number, Fix | null | undefined> // finding index -> accepted fix, null = skipped

interface Props {
  check: ReconcileCheck
  currency: string
  decisions: Decisions
  onDecide: (index: number, fix: Fix | null) => void
}

const TONE = {
  ok: { icon: <CheckCircle2 className="h-5 w-5" />, wrap: 'bg-success/15 text-success' },
  warn: { icon: <AlertTriangle className="h-5 w-5" />, wrap: 'bg-warning/15 text-warning' },
  muted: { icon: <CircleHelp className="h-5 w-5" />, wrap: 'bg-muted text-muted-foreground' },
} as const

/**
 * The reconcile result inside the import sheet. Each finding is a proposal; the user accepts it,
 * skips it, or (for amounts) types the right value. Nothing is applied until they press Import.
 */
export function ImportReview({ check, currency, decisions, onDecide }: Props) {
  const { report } = check
  const status = statusLabel(report)
  const tone = TONE[status.tone]
  const decided = Object.values(decisions).filter((d) => d !== undefined).length

  return (
    <section aria-label="Statement check" className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-border p-3">
        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone.wrap)}>{tone.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{status.title}</p>
          <p className="text-xs text-muted-foreground">{status.detail}</p>
          {report.totals.deltaMinor !== undefined && report.totals.deltaMinor !== 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Off by <b className="text-foreground">{formatAmount(Math.abs(report.totals.deltaMinor), currency)}</b>
            </p>
          )}
        </div>
      </div>

      {report.findings.length > 0 && (
        <ol className="space-y-2" aria-label="Things to look at">
          {report.findings.map((f, i) => (
            <FindingCard key={i} index={i} finding={f} currency={currency} decision={decisions[i]} onDecide={onDecide} totalsOnly={report.mode === 'totals_only'} />
          ))}
        </ol>
      )}

      {report.findings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {decided} of {report.findings.length} decided. Skipped findings import the rows as they are.
        </p>
      )}

      {report.notes.map((n) => (
        <p key={n} className="text-xs text-muted-foreground">
          {n}
        </p>
      ))}
    </section>
  )
}

function FindingCard({
  index,
  finding,
  currency,
  decision,
  onDecide,
  totalsOnly,
}: {
  index: number
  finding: Finding
  currency: string
  decision: Fix | null | undefined
  onDecide: (index: number, fix: Fix | null) => void
  totalsOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [amountText, setAmountText] = useState('')
  const options = useMemo(() => [finding, ...finding.alternatives], [finding])
  const accepted = decision !== undefined && decision !== null
  const skipped = decision === null

  const acceptAmount = () => {
    const line = finding.lines[0]
    if (line === undefined) return
    // Typed in major units; read with the same parser the statement went through.
    const parsed = parseAmount(amountText, currency)
    if (!parsed.ok || parsed.minor <= 0) return
    onDecide(index, { type: 'set_amount', line, amountMinor: parsed.minor })
    setEditing(false)
  }

  return (
    <li className={cn('rounded-xl border p-3 transition-colors', accepted ? 'border-success/50 bg-success/5' : skipped ? 'border-border opacity-60' : 'border-border')}>
      <p className="text-sm font-semibold text-foreground">
        {findingTitle(finding)}
        {finding.lines.length > 0 && <span className="ml-1 font-normal text-muted-foreground">(line {finding.lines.join(', ')})</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{finding.message}</p>

      {options.length > 1 && !totalsOnly && (
        <p className="mt-1 text-xs text-muted-foreground">Another explanation fits the same numbers: {finding.alternatives[0]?.message}</p>
      )}

      {editing ? (
        <div className="mt-2 flex gap-2">
          <Input inputMode="decimal" placeholder={`Correct amount in ${currency}`} value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-label="Correct amount" />
          <Button size="sm" onClick={acceptAmount} disabled={!amountText.trim()}>
            Use this
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Back
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((p, k) => (
            <Button key={k} size="sm" variant={decision && sameFix(decision, p.fix) ? 'default' : 'outline'} onClick={() => onDecide(index, p.fix)}>
              {fixLabel(p.fix, currency)}
            </Button>
          ))}
          {finding.lines.length === 1 && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Type the amount
            </Button>
          )}
          <Button size="sm" variant={skipped ? 'default' : 'ghost'} onClick={() => onDecide(index, null)}>
            Skip
          </Button>
        </div>
      )}
    </li>
  )
}

const sameFix = (a: Fix, b: Fix) => JSON.stringify(a) === JSON.stringify(b)

function fixLabel(fix: Fix, currency: string): string {
  switch (fix.type) {
    case 'remove_row':
      return `Remove line ${fix.line}`
    case 'flip_direction':
      return `Flip line ${fix.line}`
    case 'set_amount':
      return `Change to ${formatAmount(fix.amountMinor, currency)}`
    case 'insert_row':
      return `Add ${fix.row.direction} of ${formatAmount(fix.row.amountMinor, currency)}`
  }
}
