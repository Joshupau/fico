import type { CSSProperties } from 'react'

/**
 * Style for a `.fill-bar` (globals.css): the bar slides in with a transform instead of animating
 * width. `pct` is 0-100 and is clamped. The track around it needs `overflow-hidden`.
 */
export function fillStyle(pct: number, extra?: CSSProperties): CSSProperties {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0))
  return { ...extra, ['--fill' as string]: clamped / 100 } as CSSProperties
}

/**
 * Tell the launch splash (components/launch-splash.tsx) that the first screen can render.
 * The splash then leaves once its short intro has played. Safe to call more than once.
 */
export function signalAppReady() {
  if (typeof window === 'undefined') return
  const w = window as Window & { __ficoReady?: boolean }
  if (w.__ficoReady) return
  w.__ficoReady = true
  window.dispatchEvent(new Event('fico:ready'))
}
