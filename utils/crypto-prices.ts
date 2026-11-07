import { formatMoney } from '@/utils/formatter'

// Live crypto prices from CoinGecko's public API. One request covers every coin you hold, and the
// answer is kept for a minute, so opening screens repeatedly does not use up the free allowance.
// An optional free "demo" key (NEXT_PUBLIC_COINGECKO_KEY) raises the limit.

export type Coin = { id: string; symbol: string; name: string }

/** Popular coins, by their CoinGecko id. Anything else can be added by typing its id. */
export const COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
  { id: 'layerzero', symbol: 'ZRO', name: 'LayerZero' },
  { id: 'pancakeswap-token', symbol: 'CAKE', name: 'PancakeSwap' },
  { id: 'dai', symbol: 'DAI', name: 'Dai' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism' },
  { id: 'sui', symbol: 'SUI', name: 'Sui' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe' },
  { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave' },
  { id: 'maker', symbol: 'MKR', name: 'Maker' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain' },
  { id: 'injective-protocol', symbol: 'INJ', name: 'Injective' },
]

/** A coin's price, and when it was fetched (ms). `stale` means the live lookup failed and this is the last known one. */
export type CoinPrice = { price: number; change24h: number | null; at: number; stale: boolean }
export type CoinPrices = { prices: Record<string, CoinPrice>; fetchedAt: number; stale: boolean }

// Each coin is remembered on its own ("php:bitcoin"), so adding a coin or a failed lookup never
// throws away the prices already known for the others.
const CACHE_KEY = 'fico:coin-prices:v2'
const FRESH_MS = 60_000

type Cached = Record<string, { price: number; change24h: number | null; at: number }>

const readCache = (): Cached => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cached) : {}
  } catch {
    return {}
  }
}

const writeCache = (value: Cached) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value))
  } catch {
    // Storage can be blocked; prices just won't be remembered.
  }
}

export const coinLabel = (id?: string | null, symbol?: string | null) =>
  symbol || COINS.find((c) => c.id === id)?.symbol || (id ?? '').toUpperCase()

// Tickers with a bundled icon in public/coins/ (from @web3icons/core, MIT).
const COIN_LOGOS = new Set(COINS.map((c) => c.symbol).filter((s) => s !== 'ZRO' && s !== 'ARB'))

/** Bundled icon for a coin from the list above, if there is one. */
export const coinLogoSrc = (id?: string | null, symbol?: string | null) => {
  const ticker = coinLabel(id, symbol)
  return COIN_LOGOS.has(ticker) ? `/coins/${ticker.toLowerCase()}.svg` : undefined
}

/** Shows a coin price with enough digits to mean something: ₱3,512,000.00, ₱12.34, ₱0.001234. */
export function formatCoinPrice(price: number, currency: string, hidden = false) {
  if (hidden || !(price > 0) || price >= 1) return formatMoney(price, currency, hidden)
  const digits = Math.min(10, Math.max(2, 1 - Math.floor(Math.log10(price)) + 3))
  const whole = formatMoney(0, currency).replace(/[\d.,]+$/, '')
  return `${whole}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits })}`
}

/** "as of 3:05 PM" today, "as of Nov 6" before. */
export function priceAsOf(at: number) {
  const d = new Date(at)
  const today = new Date().toDateString() === d.toDateString()
  return `as of ${today ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

/** A coin count without exponent notation: 0.00002158 rather than 2.158e-5. */
export const formatCoinQuantity = (quantity: number) =>
  Number(quantity).toLocaleString('en-US', { maximumFractionDigits: 10 })

/**
 * Prices for the given CoinGecko ids in one currency. Coins fetched in the last minute are not asked
 * for again. If the request fails, or leaves a coin out, that coin keeps its last known price and is
 * marked stale with the time it was fetched.
 */
export async function fetchCoinPrices(ids: string[], currency: string): Promise<CoinPrices> {
  const vs = currency.toLowerCase()
  const unique = [...new Set(ids)].sort()
  const cache = readCache()
  const now = Date.now()
  const want = unique.filter((id) => !(now - (cache[`${vs}:${id}`]?.at ?? 0) < FRESH_MS))

  let failure: unknown = null
  if (want.length) {
    try {
      const params = new URLSearchParams({ ids: want.join(','), vs_currencies: vs, include_24hr_change: 'true' })
      const apiKey = process.env.NEXT_PUBLIC_COINGECKO_KEY
      if (apiKey) params.set('x_cg_demo_api_key', apiKey)
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params.toString()}`)
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`)
      const json = (await response.json()) as Record<string, Record<string, number>>
      const at = Date.now()
      for (const id of want) {
        const row = json[id]
        if (row && typeof row[vs] === 'number' && row[vs] > 0) {
          const change = row[`${vs}_24h_change`]
          cache[`${vs}:${id}`] = { price: row[vs], change24h: typeof change === 'number' ? change : null, at }
        }
      }
      writeCache(cache)
    } catch (error) {
      failure = error
    }
  }

  const prices: Record<string, CoinPrice> = {}
  let oldest = Date.now()
  for (const id of unique) {
    const hit = cache[`${vs}:${id}`]
    if (!hit) continue
    const stale = Date.now() - hit.at >= FRESH_MS * 2
    prices[id] = { ...hit, stale }
    oldest = Math.min(oldest, hit.at)
  }
  if (failure && !Object.keys(prices).length) throw failure
  return { prices, fetchedAt: oldest, stale: Object.values(prices).some((p) => p.stale) }
}
