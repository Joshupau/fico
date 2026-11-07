// App lock: the PIN is never stored, only a PBKDF2-SHA256 hash with a random salt. Face ID or a
// fingerprint goes through WebAuthn's platform authenticator, which needs no server for a local
// unlock. Tested in scripts/test-app-lock.mts.

const ITERATIONS = 150_000
const enc = new TextEncoder()

const toB64 = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s)
}
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin)

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: ITERATIONS }, key, 256)
  return toB64(bits)
}

/** Compares in constant time so a wrong PIN takes as long as a nearly right one. */
export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const candidate = await hashPin(pin, salt)
  if (candidate.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

/** Timeouts offered in Settings, in minutes. 0 locks as soon as the app is left. */
export const LOCK_TIMEOUTS = [0, 1, 5, 15] as const

/** Lock again when the app comes back after being away at least `timeoutMin` minutes. */
export function shouldLock(hiddenAt: number | null, now: number, timeoutMin: number): boolean {
  if (hiddenAt === null) return false
  return now - hiddenAt >= timeoutMin * 60_000
}

/** After 5 wrong PINs, wait 30 seconds, doubling each further miss, up to 15 minutes. */
export function lockoutMs(failures: number): number {
  if (failures < 5) return 0
  return Math.min(15 * 60_000, 30_000 * 2 ** (failures - 5))
}

// ---------- Face ID / fingerprint (WebAuthn) ----------

export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Registers this device's Face ID or fingerprint for unlocking. Returns the credential id. */
export async function registerBiometric(userLabel: string): Promise<string> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Fico' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('Face ID or fingerprint was not set up')
  return toB64(credential.rawId)
}

/** Asks for Face ID or a fingerprint. True when the person passed it. */
export async function unlockWithBiometric(credentialId: string): Promise<boolean> {
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromB64(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!result
  } catch {
    return false
  }
}
