import { supabase } from '@/utils/supabase-client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export type PushSupport = 'ready' | 'needs-install' | 'unsupported' | 'unconfigured'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Can this device get push notifications right now, and if not, why? */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  // iPhones only allow push for apps added to the Home Screen.
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  return 'ready'
}

const toKey = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const getRegistration = async () => {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ready') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

/** Asks permission, subscribes this device and saves it so the server can reach it. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for Fico in your phone settings.')

  const registration = await getRegistration()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }))

  const json = subscription.toJSON()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sign in again to turn on reminders.')
  // A new device takes the check-in time the account already picked on another one.
  const hour = await getCheckinHour()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      ...(hour !== DEFAULT_CHECKIN_HOUR ? { checkin_hour: hour } : {}),
      owner_id: auth.user.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Asks the server to send this account a test notification. */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.functions.invoke('bill-reminders', { body: { test: true } })
  if (error) throw error
}

/** Check-in hours people can pick, in Manila time (24h). */
export const CHECKIN_HOURS = [17, 18, 19, 20, 21, 22, 23] as const
export const DEFAULT_CHECKIN_HOUR = 20

export const checkinLabel = (hour: number) => {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour < 12 ? 'am' : 'pm'}`
}

/** The evening check-in hour saved for this account (Manila time). */
export async function getCheckinHour(): Promise<number> {
  const { data, error } = await supabase.from('push_subscriptions').select('checkin_hour').limit(1).maybeSingle()
  if (error || !data) return DEFAULT_CHECKIN_HOUR
  return Number((data as { checkin_hour?: number }).checkin_hour ?? DEFAULT_CHECKIN_HOUR)
}

/** Saves the check-in hour on every device of this account, so they all ring at the same time. */
export async function setCheckinHour(hour: number): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sign in again to change the check-in time.')
  const { error } = await supabase.from('push_subscriptions').update({ checkin_hour: hour }).eq('owner_id', auth.user.id)
  if (error) {
    if (/checkin_hour/.test(error.message)) throw new Error('The server needs an update before you can change this.')
    throw error
  }
}
