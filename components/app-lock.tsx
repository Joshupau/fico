'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Delete, Fingerprint } from 'lucide-react'
import { useAppLock } from '@/store/app-lock-store'
import { lockoutMs, shouldLock, unlockWithBiometric, verifyPin } from '@/utils/app-lock'
import { supabase } from '@/utils/supabase-client'
import { cn } from '@/lib/utils'

/** The time, for event handlers (kept out of render). */
const clock = () => Date.now()

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Covers the whole app (above every page, sheet and the hidden-amounts screen) while it is locked.
 * Locks on start and when the app comes back after the chosen timeout.
 */
export function AppLock() {
  const lock = useAppLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Lock on start, and when coming back after the timeout.
  useEffect(() => {
    const state = useAppLock.getState()
    if (state.enabled && state.pinHash) state.set({ locked: true })
    const onVisibility = () => {
      const s = useAppLock.getState()
      if (!s.enabled) return
      if (document.visibilityState === 'hidden') {
        if (!s.locked) s.set({ hiddenAt: Date.now() })
      } else if (shouldLock(s.hiddenAt, Date.now(), s.timeoutMin)) {
        s.set({ locked: true, hiddenAt: null })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onVisibility)
    }
  }, [])

  // Tick while a lockout is counting down.
  const waitMs = Math.max(0, lock.lockedUntil - now)
  useEffect(() => {
    if (!lock.locked || lock.lockedUntil <= Date.now()) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [lock.locked, lock.lockedUntil])

  if (!lock.enabled || !lock.locked || !lock.pinHash || !lock.salt) return null

  const unlock = () => {
    lock.set({ locked: false, failures: 0, lockedUntil: 0, hiddenAt: null })
    setPin('')
    setError(null)
  }

  const submit = async (value: string) => {
    setChecking(true)
    const ok = await verifyPin(value, lock.salt!, lock.pinHash!)
    setChecking(false)
    if (ok) return unlock()
    const failures = lock.failures + 1
    const wait = lockoutMs(failures)
    const at = clock()
    lock.set({ failures, lockedUntil: wait ? at + wait : 0 })
    setNow(at)
    setPin('')
    setError(wait ? null : 'Wrong PIN')
    if ('vibrate' in navigator) navigator.vibrate?.(80)
  }

  const press = (digit: string) => {
    if (checking || waitMs > 0 || pin.length >= lock.pinLength) return
    const next = pin + digit
    setPin(next)
    setError(null)
    if (next.length === lock.pinLength) void submit(next)
  }

  const biometric = async () => {
    if (lock.biometricId && (await unlockWithBiometric(lock.biometricId))) unlock()
  }

  const forgot = async () => {
    // The only way past a forgotten PIN: sign out, which also turns the lock off on this device.
    lock.disable()
    await supabase.auth.signOut().catch(() => {})
    window.location.assign('/signin')
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Fico is locked" className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-background px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <Image src="/icon-512.png" alt="" width={64} height={64} className="size-16 rounded-[20px] shadow-ios" />
      <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">Enter your PIN</h1>
      <p className="mt-1 h-5 text-sm text-muted-foreground" aria-live="polite">
        {waitMs > 0 ? `Too many tries. Wait ${Math.ceil(waitMs / 1000)}s.` : error ?? ''}
      </p>

      <div className={cn('mt-5 flex gap-3', error && 'animate-[shake_0.3s]')} aria-hidden="true">
        {Array.from({ length: lock.pinLength }, (_, i) => (
          <span key={i} className={cn('size-3.5 rounded-full border-2 border-foreground/70 transition-colors', i < pin.length && 'bg-foreground')} />
        ))}
      </div>

      <div className="mt-8 grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className="aspect-square rounded-full bg-secondary text-2xl font-semibold text-foreground transition-colors active:bg-secondary/60">
            {k}
          </button>
        ))}
        {lock.biometricId ? (
          <button type="button" onClick={biometric} aria-label="Unlock with Face ID or fingerprint" className="flex aspect-square items-center justify-center rounded-full text-primary">
            <Fingerprint className="size-8" />
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press('0')} className="aspect-square rounded-full bg-secondary text-2xl font-semibold text-foreground transition-colors active:bg-secondary/60">
          0
        </button>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete" className="flex aspect-square items-center justify-center rounded-full text-muted-foreground">
          <Delete className="size-7" />
        </button>
      </div>

      <button type="button" onClick={forgot} className="mt-8 text-sm font-medium text-muted-foreground hover:text-foreground">
        Forgot PIN? Sign out
      </button>
    </div>
  )
}
