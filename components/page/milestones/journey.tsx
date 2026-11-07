'use client'

import { format, parseISO } from 'date-fns'
import { Flag } from 'lucide-react'
import { useSubjectMilestones } from '@/queries/user/milestone/milestones'
import type { MilestoneKind } from '@/utils/milestones'
import { cn } from '@/lib/utils'

const TICKS = [25, 50, 75]

/** A progress bar with tick marks at 25, 50 and 75%, each filled once passed. */
export function TickedProgress({ pct, done, label, tone = 'primary' }: { pct: number; done?: boolean; label: string; tone?: 'primary' | 'success' }) {
  const fill = done ? 'bg-success' : tone === 'success' ? 'bg-success' : 'bg-primary'
  return (
    <div className="relative mt-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full transition-all', fill)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {TICKS.map((t) => (
        <span
          key={t}
          aria-hidden="true"
          className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card', pct >= t ? fill : 'bg-muted-foreground/30')}
          style={{ left: `${t}%` }}
        />
      ))}
    </div>
  )
}

const LABELS: Record<string, string> = {
  first: 'First deposit',
  '25': '25%',
  '50': 'Halfway',
  '75': '75%',
  '100': 'Reached',
  cleared: 'Cleared',
  'first-return': 'First return',
  'above-principal': 'Back above cost',
}

const labelOf = (kind: MilestoneKind, level: string, title: string | null) => {
  if (kind !== 'goal' && level === '50') return 'Half paid'
  if (level.startsWith('installment-')) return `Payment ${level.slice(12)}`
  if (level.startsWith('below-')) return title ?? 'Under a round number'
  return LABELS[level] ?? title ?? level
}

/** "Started Aug 3 · First deposit Aug 10 · Halfway Oct 2", from the milestones reached so far. */
export function MilestoneJourney({ kind, subjectId, startedAt, max = 4 }: { kind: MilestoneKind; subjectId: string; startedAt?: string | null; max?: number }) {
  const reached = useSubjectMilestones(kind, subjectId)
  if (reached.length === 0) return null
  // Installments add up quickly: keep the latest few, and always the bigger moments.
  const notable = reached.filter((m) => !m.level.startsWith('installment-'))
  const installments = reached.filter((m) => m.level.startsWith('installment-'))
  const shown = [...notable, ...installments.slice(-1)].sort((a, b) => a.reachedAt.localeCompare(b.reachedAt)).slice(-max)
  const steps = [
    ...(startedAt ? [{ key: 'start', label: 'Started', at: startedAt }] : []),
    ...shown.map((m) => ({ key: m.id, label: labelOf(m.kind, m.level, m.title), at: m.reachedAt })),
  ]
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground" aria-label="Journey so far">
      <Flag className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>
            <span className="font-medium text-foreground">{s.label}</span> {format(parseISO(s.at), 'MMM d')}
          </span>
        </li>
      ))}
    </ol>
  )
}
