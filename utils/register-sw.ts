/**
 * Registers the service worker so the app opens offline after one online visit, and watches for
 * new versions. Skipped in dev (it would serve stale bundles over HMR) and in the Capacitor apps,
 * which already ship the files inside the native bundle.
 *
 * Every deploy changes sw.js (scripts/build-sw.mjs), so the browser installs the new worker next to
 * the running one, where it waits. The app then shows its update bar (components/update-bar.tsx)
 * and only switches when the user agrees: applyUpdate() activates the waiting worker and reloads.
 */

type Listener = (updateReady: boolean) => void

let waiting: ServiceWorker | null = null
const listeners = new Set<Listener>()
const notify = () => listeners.forEach((listener) => listener(!!waiting))

/** Calls `listener` now and whenever an update becomes ready. Returns an unsubscribe function. */
export function onUpdateReady(listener: Listener) {
  listeners.add(listener)
  listener(!!waiting)
  return () => {
    listeners.delete(listener)
  }
}

/** Switches to the waiting version and reloads once it has taken over. */
export function applyUpdate() {
  if (!waiting) {
    window.location.reload()
    return
  }
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
  waiting.postMessage({ type: 'SKIP_WAITING' })
  // If the switch never happens (say the waiting worker was replaced), reload anyway: page loads
  // come from the network, so the user still ends up on the latest version.
  window.setTimeout(() => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }, 4000)
}

// A newer build is only "ready" once installed while an older one still runs this page.
const setWaiting = (worker: ServiceWorker | null) => {
  if (!worker || !navigator.serviceWorker.controller) return
  const check = () => {
    if (worker.state === 'installed') {
      waiting = worker
      notify()
    } else if (worker.state === 'redundant' && waiting === worker) {
      waiting = null
      notify()
    }
  }
  check()
  worker.addEventListener('statechange', check)
}

const CHECK_EVERY_MS = 30 * 60 * 1000

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (process.env.NODE_ENV !== 'production') return
  if (!/^https?:$/.test(window.location.protocol)) return

  const register = async () => {
    try {
      // updateViaCache 'none': always ask the server for sw.js, never the HTTP cache.
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      setWaiting(registration.waiting)
      registration.addEventListener('updatefound', () => setWaiting(registration.installing))

      // The app rarely does full page loads, so look for a new version when it comes back into view
      // and every half hour while open.
      const check = () => registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_EVERY_MS)
    } catch {
      // No service worker: the app still works online.
    }
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
