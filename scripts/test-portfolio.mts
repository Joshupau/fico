// Portfolio returns and mix, against a hand-checked example. Run: npx tsx scripts/test-portfolio.mts
import { portfolioMix, portfolioReturn, type PortfolioHolding, type ValuePoint } from '../utils/portfolio'

let failures = 0
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString()
const now = new Date(2026, 10, 7, 12) // Nov 7 2026, noon

const holdings: PortfolioHolding[] = [
  // A: stocks bought Jan 10 for 10,000; updated to 11,000 in June and 11,500 on Nov 1; worth 12,000 now; 500 paid out.
  { id: 'A', name: 'Stocks', type: 'stocks', currency: 'PHP', principal: 10_000, value: 12_000, dividends: 500, startDate: at(2026, 1, 10), status: 'active' },
  // B: a bond bought Nov 3 for 5,000, worth 5,050 now.
  { id: 'B', name: 'Bond', type: 'bonds', currency: 'USD', principal: 5_000, value: 5_050, dividends: 0, startDate: at(2026, 11, 3), status: 'active' },
  // C: crypto bought Dec 1 2025 for 20,000; daily prices put it at 25,000 on Oct 30 and 28,000 on Nov 6; 30,000 live now.
  { id: 'C', name: 'Bitcoin', type: 'crypto', currency: 'PHP', principal: 20_000, value: 30_000, dividends: 0, startDate: at(2025, 12, 1), status: 'active', live: true },
  // Sold holdings never count.
  { id: 'S', name: 'Sold fund', type: 'mutual_funds', currency: 'PHP', principal: 9_000, value: 9_500, dividends: 0, startDate: at(2025, 1, 1), status: 'sold' },
]
const points: ValuePoint[] = [
  { investmentId: 'A', date: at(2026, 6, 1), value: 11_000 },
  { investmentId: 'A', date: at(2026, 11, 1), value: 11_500 },
  { investmentId: 'C', date: at(2026, 10, 30), value: 25_000 },
  { investmentId: 'C', date: at(2026, 11, 6), value: 28_000 },
]

// Today: start 11,500 + 5,000 + 28,000 = 44,500; end 47,050; gain 2,550.
let r = portfolioReturn(holdings, points, 'today', now)
check('today', r.start === 44_500 && r.contributions === 0 && r.end === 47_050 && r.gain === 2_550 && near(r.rate, 2_550 / 44_500), r)

// 1W from Oct 31: A at 11,000 (June), B bought inside (+5,000 put in), C at 25,000. Gain 47,050 − 36,000 − 5,000 = 6,050.
r = portfolioReturn(holdings, points, '1w', now)
check('1W', r.start === 36_000 && r.contributions === 5_000 && r.gain === 6_050 && near(r.rate, 6_050 / 41_000), r)

// YTD: A and B bought this year (15,000 put in), C at its 20,000 cost. Gain 47,050 − 20,000 − 15,000 = 12,050.
r = portfolioReturn(holdings, points, 'ytd', now)
check('YTD', r.start === 20_000 && r.contributions === 15_000 && r.gain === 12_050 && near(r.rate, 12_050 / 35_000), r)

// 1Y from Nov 7 2025: everything bought inside.
r = portfolioReturn(holdings, points, '1y', now)
check('1Y', r.start === 0 && r.contributions === 35_000 && r.gain === 12_050, r)

// All: 47,050 − 35,000 + 500 returns = 12,550.
r = portfolioReturn(holdings, points, 'all', now)
check('All includes returns received', r.gain === 12_550 && r.dividends === 500 && near(r.rate, 12_550 / 35_000) && r.counted === 3, r)

// Crypto with no price near the start of the period is left out, not guessed.
r = portfolioReturn(holdings, points.filter((p) => p.date !== at(2026, 11, 6)), 'today', now)
check('stale crypto start is left out', r.missing.join() === 'Bitcoin' && r.start === 16_500 && r.end === 17_050, r)

// A manually valued holding keeps its last update as the start value, however old.
r = portfolioReturn(holdings.filter((h) => h.id === 'A'), points.filter((p) => p.investmentId !== 'A' || p.date === at(2026, 6, 1)), 'today', now)
check('manual value carries forward', r.start === 11_000 && r.gain === 1_000 && r.missing.length === 0, r)

// Mix: 47,050 total; Bitcoin 63.8% is over a 30% limit, Stocks 25.5% is not.
const mix = portfolioMix(holdings, 0.3)
check('mix total skips sold', mix.total === 47_050, mix.total)
check('largest first', mix.byHolding.map((s) => s.key).join() === 'C,A,B', mix.byHolding)
check('concentration warning', mix.concentrated.map((s) => s.key).join() === 'C' && near(mix.concentrated[0].share, 30_000 / 47_050), mix.concentrated)
check('by type', mix.byType[0].key === 'crypto' && mix.byType.length === 3, mix.byType)
check('by currency', mix.byCurrency.map((s) => `${s.key}:${s.value}`).join() === 'PHP:42000,USD:5050', mix.byCurrency)
check('a higher limit clears the warning', portfolioMix(holdings, 0.7).concentrated.length === 0)
check('one holding is never flagged', portfolioMix(holdings.slice(0, 1), 0.3).concentrated.length === 0)

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
