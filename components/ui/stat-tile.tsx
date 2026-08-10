'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { cn } from '@/lib/utils'

type StatTone = 'primary' | 'success' | 'warning' | 'destructive' | 'accent' | 'highlight' | 'neutral'

const TONE_STYLES: Record<StatTone, { iconWrap: string; card: string; noteColor?: string; valueColor?: string }> = {
  primary: {
    iconWrap: 'bg-primary/15 text-primary',
    card: 'border-primary/25 bg-gradient-to-br from-primary/10 to-transparent',
    valueColor: 'text-primary',
  },
  success: {
    iconWrap: 'bg-success/15 text-success',
    card: 'border-success/25 bg-gradient-to-br from-success/10 to-transparent',
    noteColor: 'text-success',
    valueColor: 'text-success',
  },
  warning: {
    iconWrap: 'bg-warning/15 text-warning',
    card: 'border-warning/25 bg-gradient-to-br from-warning/10 to-transparent',
    noteColor: 'text-warning',
    valueColor: 'text-warning',
  },
  destructive: {
    iconWrap: 'bg-destructive/15 text-destructive',
    card: 'border-destructive/25 bg-gradient-to-br from-destructive/10 to-transparent',
    noteColor: 'text-destructive',
    valueColor: 'text-destructive',
  },
  accent: {
    iconWrap: 'bg-accent/15 text-accent',
    card: 'border-accent/25 bg-gradient-to-br from-accent/10 to-transparent',
    valueColor: 'text-accent',
  },
  highlight: {
    iconWrap: 'bg-[var(--chart-5)]/15 text-[var(--chart-5)]',
    card: 'border-[var(--chart-5)]/25 bg-gradient-to-br from-[var(--chart-5)]/10 to-transparent',
    valueColor: 'text-[var(--chart-5)]',
  },
  neutral: {
    iconWrap: 'bg-secondary text-foreground',
    card: 'border-border bg-card',
  },
}

/** Grid wrapper shared by every stat-tile row in the app (2-col mobile, 4-col desktop). */
export function StatGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4', className)}>{children}</div>
}

interface StatTileProps {
  label: string
  /** Pre-formatted value (money string, count, etc). Masked with dots when hidden. */
  value: React.ReactNode
  note?: React.ReactNode
  icon: React.ReactNode
  tone?: StatTone
  /** Shows the eye/eye-off toggle and masks `value`, defaulting to the user's hide-amounts setting. */
  hideable?: boolean
  /** Colors the value text with the tone color instead of the default foreground. */
  coloredValue?: boolean
  /** Extra content rendered next to the icon (e.g. a trend badge). */
  trailing?: React.ReactNode
  isLoading?: boolean
  className?: string
}

export function StatTile({
  label,
  value,
  note,
  icon,
  tone = 'neutral',
  hideable = false,
  coloredValue = false,
  trailing,
  isLoading = false,
  className,
}: StatTileProps) {
  const hideAmountsOnOpen = useSettingsStore((s) => s.hideAmountsOnOpen)
  const [visible, setVisible] = useState(!hideAmountsOnOpen)

  useEffect(() => {
    setVisible(!hideAmountsOnOpen)
  }, [hideAmountsOnOpen])

  const styles = TONE_STYLES[tone]
  const showValue = !hideable || visible

  return (
    <div className={cn('min-w-0 rounded-xl border p-3 sm:p-6', styles.card, className)}>
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          <div className={cn('shrink-0 rounded-lg p-2 sm:p-3', styles.iconWrap)}>{icon}</div>
          {hideable && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="shrink-0 rounded-lg bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            >
              {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-7 animate-pulse rounded-md bg-secondary sm:h-8" />
          {note !== undefined && <div className="h-3 w-2/3 animate-pulse rounded-md bg-secondary" />}
        </div>
      ) : (
        <>
          <p
            className={cn(
              'truncate text-lg font-bold sm:text-2xl',
              coloredValue && styles.valueColor ? styles.valueColor : 'text-foreground'
            )}
          >
            {showValue ? value : '••••••'}
          </p>
          {note !== undefined && (
            <p className={cn('mt-1 text-[10px] text-muted-foreground sm:mt-2 sm:text-xs', styles.noteColor)}>{note}</p>
          )}
        </>
      )}
    </div>
  )
}
