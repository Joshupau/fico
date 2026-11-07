// App lock PIN hashing and timing. Run: npx tsx scripts/test-app-lock.mts
import { hashPin, isValidPin, lockoutMs, newSalt, shouldLock, verifyPin } from '../utils/app-lock'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

const salt = newSalt()
const hash = await hashPin('482915', salt)
check('hash is not the PIN', !hash.includes('482915') && hash.length === 44, hash)
check('right PIN unlocks', await verifyPin('482915', salt, hash))
check('wrong PIN does not', !(await verifyPin('482916', salt, hash)))
check('same PIN, other salt, other hash', (await hashPin('482915', newSalt())) !== hash)
check('PIN rules', isValidPin('1234') && isValidPin('123456') && !isValidPin('123') && !isValidPin('12a4') && !isValidPin('1234567'))

const now = 10_000_000
check('locks right away with timeout 0', shouldLock(now - 1, now, 0))
check('stays open inside the timeout', !shouldLock(now - 30_000, now, 1))
check('locks after the timeout', shouldLock(now - 60_000, now, 1))
check('never hidden, no lock', !shouldLock(null, now, 0))
check('lockout after 5 misses, doubling, capped', lockoutMs(4) === 0 && lockoutMs(5) === 30_000 && lockoutMs(6) === 60_000 && lockoutMs(20) === 15 * 60_000)

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
