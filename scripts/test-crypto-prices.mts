// Crypto price fallback and formatting. Run: npx tsx scripts/test-crypto-prices.mts
let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// A tiny window.localStorage and a fetch we control.
const store = new Map<string, string>()
;(globalThis as any).window = {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
}
let reply: () => Promise<Response> = async () => new Response('{}')
let calls: string[] = []
;(globalThis as any).fetch = async (url: string) => {
  calls.push(url)
  return reply()
}

const { fetchCoinPrices, formatCoinPrice, formatCoinQuantity } = await import('../utils/crypto-prices')

// 1. A good answer is remembered per coin.
reply = async () => new Response(JSON.stringify({ bitcoin: { php: 3_500_000, php_24h_change: 1.5 }, pepe: { php: 0.000612 } }))
let r = await fetchCoinPrices(['bitcoin', 'pepe'], 'PHP')
check('live prices', r.prices.bitcoin?.price === 3_500_000 && r.prices.pepe?.price === 0.000612 && !r.stale, r)

// 2. Within a minute nothing is asked again.
calls = []
await fetchCoinPrices(['pepe', 'bitcoin'], 'PHP')
check('fresh prices are not fetched again', calls.length === 0, calls)

// 3. Adding a coin asks only for the new one, and keeps the others even when that request fails.
reply = async () => new Response('rate limited', { status: 429 })
calls = []
r = await fetchCoinPrices(['bitcoin', 'pepe', 'solana'], 'PHP')
check('only the new coin is requested', calls.length === 1 && calls[0].includes('ids=solana'), calls)
check('known coins survive a failed lookup', r.prices.bitcoin?.price === 3_500_000 && !r.prices.solana, r)

// 4. Old prices come back marked stale with their time.
const old = JSON.parse(store.get('fico:coin-prices:v2')!)
old['php:bitcoin'].at = Date.now() - 3_600_000
store.set('fico:coin-prices:v2', JSON.stringify(old))
r = await fetchCoinPrices(['bitcoin'], 'PHP')
check('stale fallback keeps the last price and its time', r.stale && r.prices.bitcoin.stale && r.prices.bitcoin.at === old['php:bitcoin'].at, r)

// 5. Nothing known and the lookup fails: the caller sees the error.
let threw = false
try {
  await fetchCoinPrices(['cardano'], 'PHP')
} catch {
  threw = true
}
check('no price at all throws', threw)

// 6. Small prices and quantities stay readable.
check('big price', formatCoinPrice(3_500_000, 'PHP') === '₱3,500,000.00', formatCoinPrice(3_500_000, 'PHP'))
check('tiny price keeps its digits', formatCoinPrice(0.000612, 'PHP') === '₱0.000612', formatCoinPrice(0.000612, 'PHP'))
check('sub-peso price', formatCoinPrice(0.5, 'PHP') === '₱0.50', formatCoinPrice(0.5, 'PHP'))
check('hidden price', formatCoinPrice(0.000612, 'PHP', true) === '••••••')
check('small quantity, no exponent', formatCoinQuantity(0.00002158) === '0.00002158', formatCoinQuantity(0.00002158))

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
