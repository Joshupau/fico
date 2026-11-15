/**
 * Synthetic quick-add messages with token labels, built from templates. Used only for training;
 * the held-out set in datasets/quickadd/test.jsonl was written by hand and never comes from here.
 * Everything is invented. Wallet names are the ones a Filipino user is likely to configure.
 */
import { tokenize } from './tokenize'
import type { Example, MessageType } from './tagger'

type Rng = () => number
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T
const chance = (rng: Rng, p: number) => rng() < p

/** Item or activity phrases per category: what people actually type, in English and Filipino. */
export const CATEGORY_ITEMS: Record<string, string[]> = {
  'Food & Dining': ['lunch', 'dinner', 'breakfast', 'coffee', 'milk tea', 'merienda', 'kain', 'kain sa labas', 'snacks', 'jollibee', 'mcdo', 'pizza', 'burger', 'siomai', 'ramen', 'samgyup', 'fast food', 'takeout', 'resto', 'ulam', 'tapsilog', 'taho', 'kwek kwek', 'shawarma', 'buffet', 'pares', 'lugaw', 'iced coffee', 'brunch', 'inom'],
  Groceries: ['groceries', 'grocery', 'bigas', 'eggs', 'itlog', 'palengke', 'supermarket', 'puregold', 'sm grocery', 'vegetables', 'gulay', 'meat', 'karne', 'pantry', 'weekly grocery', 'toiletries', 'detergent', 'sabon', 'baby wipes'],
  Transportation: ['grab', 'taxi', 'jeep', 'jeepney', 'tricycle', 'trike', 'angkas', 'bus', 'pamasahe', 'parking', 'toll', 'gas', 'gasoline', 'fuel', 'uv express', 'mrt', 'lrt', 'ferry', 'habal habal', 'motor gas', 'car wash', 'joyride'],
  'Bills & Utilities': ['electric bill', 'kuryente', 'meralco', 'water bill', 'tubig', 'internet', 'wifi', 'pldt', 'globe', 'converge', 'load', 'mobile load', 'postpaid', 'prepaid load', 'cable', 'phone bill', 'globe at home', 'smart bill'],
  Rent: ['rent', 'upa', 'renta', 'apartment rent', 'boarding house', 'dorm', 'room rent', 'condo dues', 'association dues'],
  Healthcare: ['medicine', 'gamot', 'pharmacy', 'mercury drug', 'dentist', 'doctor', 'checkup', 'vitamins', 'clinic', 'lab test', 'eye checkup', 'meds', 'hospital bill', 'consultation', 'paracetamol'],
  Entertainment: ['movie', 'sine', 'cinema', 'concert', 'netflix night', 'arcade', 'karaoke', 'videoke', 'games', 'steam game', 'gig', 'bar', 'billiards', 'bowling'],
  Shopping: ['shopee', 'lazada', 'tiktok shop', 'online order', 'gadget', 'headphones', 'phone case', 'charger', 'home decor', 'kitchenware', 'skincare', 'makeup', 'perfume', 'bag', 'watch'],
  Education: ['tuition', 'school supplies', 'books', 'enrollment', 'udemy course', 'review center', 'exam fee', 'uniform', 'thesis printing', 'tuition ni bunso', 'school project'],
  Insurance: ['insurance', 'insurance premium', 'life insurance', 'car insurance', 'philhealth', 'sss', 'pag-ibig', 'hmo', 'vul payment'],
  Clothing: ['shirt', 'damit', 'shoes', 'sapatos', 'pants', 'jacket', 'uniqlo', 'running shoes', 'sneakers', 'ukay', 'dress', 'slippers', 'tsinelas', 'socks'],
  'Personal Care': ['haircut', 'gupit', 'barber', 'salon', 'nails', 'massage', 'spa', 'shampoo', 'razor', 'skincare routine', 'facial'],
  Travel: ['hotel', 'airbnb', 'flight', 'plane ticket', 'cebu pacific', 'bus to baguio', 'resort', 'tour', 'travel tax', 'beach trip', 'terminal fee'],
  Subscription: ['spotify', 'netflix', 'youtube premium', 'icloud', 'google one', 'disney plus', 'canva', 'chatgpt', 'gym membership', 'vpn', 'apple music', 'notion'],
  Donation: ['donation', 'donasyon', 'church', 'offering', 'abuloy', 'charity', 'tithes', 'fundraiser', 'ambag'],
  Pets: ['dog food', 'cat food', 'vet', 'pet grooming', 'cat litter', 'pet vitamins', 'pagkain ng aso', 'pagkain ng pusa'],
  'Other Expense': ['gift', 'regalo', 'gift for mama', 'gift for ate', 'regalo kay papa', 'laundry', 'labada', 'printing', 'water refill', 'balloon', 'repair', 'plumber', 'padlock', 'tip', 'pasalubong', 'paid kuya back', 'bayad utang', 'binayaran ko si ate', 'ambag'],
  Salary: ['salary', 'sahod', 'sweldo', 'payroll', '13th month', '13th month pay', 'bonus', 'overtime pay', 'back pay', 'payday'],
  Freelance: ['freelance', 'client payment', 'client paid', 'side gig', 'raket', 'commission', 'project payment', 'upwork', 'gig payout', 'consulting fee'],
  Business: ['sales', 'benta', 'nabenta', 'sold', 'online shop sales', 'kita sa tindahan', 'resell', 'store income'],
  Investment: ['dividend', 'interest', 'stock dividend', 'crypto gain', 'interest earned', 'tubo', 'fund gains', 'mp2 dividend'],
  Remittance: ['padala', 'remittance', 'padala ni tito', 'padala ng kapatid', 'western union', 'palawan express', 'money from abroad', 'sent by mama'],
  Gift: ['gift money', 'birthday money', 'aguinaldo', 'pamasko', 'regalo na pera', 'cash gift', 'wedding gift', 'ninong gift', 'gift from mama', 'regalo galing kay tita', 'birthday money from lola'],
  'Other Income': ['refund', 'cashback', 'rebate', 'raffle', 'reimbursement', 'binayaran na utang', 'utang bayad', 'found money', 'allowance', 'tip received', 'prize', 'tip', 'tips', 'client paid', 'paid me', 'bayad ni kuya sakin', 'customer paid', 'sold stuff', 'winnings'],
}
export const CATEGORIES = Object.keys(CATEGORY_ITEMS)
const INCOME_CATS = new Set(['Salary', 'Freelance', 'Business', 'Investment', 'Remittance', 'Gift', 'Other Income'])

export const WALLETS = [
  { name: 'GCash', type: 'ewallet', aliases: ['gcash', 'g cash', 'gcas', 'gc', 'gcsh'] },
  { name: 'GoTyme', type: 'bank', aliases: ['gotyme', 'gotym', 'go tyme', 'gotime'] },
  { name: 'Cash', type: 'cash', aliases: ['cash', 'cash on hand', 'wallet', 'pera'] },
  { name: 'GoTyme Emergency', type: 'savings', aliases: ['gotyme emergency', 'emergency fund', 'emergency', 'gotyme ef'] },
  { name: 'BDO Unibank', type: 'bank', aliases: ['bdo', 'bdo unibank', 'bdo acct', 'bdo account'] },
  { name: 'BPI Credit Card', type: 'credit_card', aliases: ['bpi', 'bpi credit card', 'bpi cc', 'bpi card', 'credit card', 'cc'] },
  { name: 'Maya', type: 'ewallet', aliases: ['maya', 'paymaya', 'maya wallet'] },
  { name: 'UnionBank', type: 'bank', aliases: ['unionbank', 'union bank', 'ub'] },
  { name: 'Seabank', type: 'bank', aliases: ['seabank', 'sea bank'] },
] as const

const EXPENSE_VERBS = ['', '', '', 'paid', 'bought', 'spent', 'nagbayad ng', 'binili ko', 'bayad', 'binayaran ko yung', 'bumili ng', 'nag', 'pang', 'pa', 'gastos sa', 'nagbayad ako ng', 'pay', 'bili']
const INCOME_VERBS = ['', 'received', 'got', 'nakatanggap ng', 'natanggap ko', 'dumating', 'received my', 'got my', 'nakuha ko', 'credited', 'in:', 'plus', 'got paid', 'paid by client', 'binayaran ako ng', 'bayad sakin', 'may nagbayad', 'tip', 'nag tip', 'pumasok na', 'in na', 'deposited to me', 'binigay sakin']
const TRANSFER_VERBS = ['transfer', 'transferred', 'moved', 'sent', 'pasa', 'lipat', 'nilipat ko', 'inilipat', 'ipon', 'cash in', 'top up', 'send', 'fund transfer', 'xfer']
const WITHDRAW_VERBS = ['withdrew', 'withdraw', 'nag withdraw', 'atm', 'cash out', 'nagwithdraw ng']
const FILLERS = ['', '', '', 'ko', 'na', 'lang', 'ulit', 'today', 'ngayon', 'kanina', 'sa', 'for', 'ng', 'yung', 'para sa', 'with', 'via', 'gamit', 'thru', 'from', 'using', 'sa', 'my']
const PEOPLE = ['ni mama', 'ni ate', 'ni kuya', 'ni tito', 'ni bunso', 'kay papa', 'for mom', 'with friends', 'kasama si babe', 'ni lola']
const DATE_PHRASES: [string, string][] = [
  ['kahapon', 'yesterday'], ['yesterday', 'yesterday'], ['last monday', 'weekday'], ['last friday', 'weekday'], ['noong sabado', 'weekday'], ['last week', 'none'],
  ['oct 15', 'md'], ['sept 30', 'md'], ['nov 2', 'md'], ['10/18', 'num'], ['two days ago', 'ago'], ['3 days ago', 'ago'], ['kanina', 'today'], ['today', 'today'], ['on the 1st', 'ord'], ['last tuesday', 'weekday'],
]

function amountText(rng: Rng, kind: MessageType, cat?: string): string {
  const big = kind !== 'expense' || cat === 'Rent' || cat === 'Education' || cat === 'Travel' || cat === 'Insurance'
  const style = rng()
  let n: number
  if (big) n = chance(rng, 0.5) ? Math.floor(rng() * 40 + 1) * 500 : Math.floor(rng() * 50000 + 1000)
  else n = chance(rng, 0.4) ? Math.floor(rng() * 20 + 1) * 50 : Math.floor(rng() * 3000 + 10)
  if (style < 0.12 && n >= 1000 && n % 100 === 0) return (n / 1000).toString().replace(/\.0$/, '') + pick(rng, ['k', 'K'])
  if (style < 0.22) return n.toFixed(2)
  if (style < 0.3 && n >= 1000) return n.toLocaleString('en-US')
  if (style < 0.36) return pick(rng, ['₱', 'PHP', 'php', 'P', 'Php ']) + n
  if (style < 0.42) return n + pick(rng, [' pesos', 'pesos', ' php', 'php', ' peso'])
  if (style < 0.47 && n < 1000) return (n + rng() * 0.99).toFixed(2)
  return String(n)
}

function typo(rng: Rng, word: string): string {
  if (word.length < 4) return word
  const i = 1 + Math.floor(rng() * (word.length - 2))
  const kind = rng()
  if (kind < 0.35) return word.slice(0, i) + word.slice(i + 1) // drop
  if (kind < 0.7) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2) // swap
  if (kind < 0.85) return word.slice(0, i) + word[i] + word.slice(i) // double
  return word.slice(0, i) + pick(rng, ['a', 'e', 'i', 'o', 'u', 's', 'n']) + word.slice(i + 1) // substitute
}

interface Piece {
  text: string
  entity?: 'AMOUNT' | 'WALLET' | 'WALLET_TO' | 'CAT' | 'DATE' | 'QTY' | 'FEE' | 'NOTE'
}

function walletText(rng: Rng, w: (typeof WALLETS)[number], noisy: boolean): string {
  let s: string = pick(rng, w.aliases)
  if (noisy && chance(rng, 0.3)) s = typo(rng, s)
  if (chance(rng, 0.2)) s = s.toUpperCase()
  return s
}

function build(rng: Rng, pieces: Piece[], noisy: boolean): { text: string; tags: string[] } | null {
  const parts: { text: string; entity?: Piece['entity'] }[] = pieces.filter((p) => p.text.trim())
  // Glue the amount to the previous word sometimes ("lunch150") and drop spaces.
  let text = ''
  const ranges: { start: number; end: number; entity: Piece['entity'] }[] = []
  parts.forEach((p, i) => {
    let t = p.text.trim()
    if (noisy && p.entity === 'CAT' && chance(rng, 0.25)) t = t.split(' ').map((w) => (chance(rng, 0.5) ? typo(rng, w) : w)).join(' ')
    if (noisy && chance(rng, 0.15)) t = t.toUpperCase()
    const glue = i > 0 && noisy && p.entity === 'AMOUNT' && chance(rng, 0.35) && /[a-z]$/i.test(text)
    const sep = i === 0 ? '' : glue ? '' : chance(rng, noisy ? 0.08 : 0.02) ? '  ' : ' '
    text += sep
    const start = text.length
    text += t
    if (p.entity) ranges.push({ start, end: text.length, entity: p.entity })
  })
  const tokens = tokenize(text)
  const tags = tokens.map((tok) => {
    const r = ranges.find((x) => tok.start >= x.start && tok.end <= x.end)
    if (!r) return 'O'
    const first = tokens.find((t2) => t2.start >= r.start && t2.end <= r.end)
    return (first === tok ? 'B-' : 'I-') + r.entity
  })
  return tokens.length ? { text, tags } : null
}

export interface SynthOptions {
  count: number
  seed?: number
  /** 0..1 share of messages that get typos, glued amounts and odd casing. */
  noise?: number
  /** Which template families to use; lets the split be made by template. */
  templates?: number[]
  /** Lower-cased texts that must never be generated (the held-out set). */
  exclude?: Set<string>
}

const TEMPLATE_COUNT = 10

export function generateExamples(options: SynthOptions): Example[] {
  const rng = seededRng(options.seed ?? 7)
  const noise = options.noise ?? 0.4
  const allowed = options.templates ?? Array.from({ length: TEMPLATE_COUNT }, (_, i) => i)
  const out: Example[] = []
  let guard = 0
  while (out.length < options.count && guard++ < options.count * 10) {
    const template = pick(rng, allowed)
    const noisy = chance(rng, noise)
    const kindRoll = rng()
    const type: MessageType = kindRoll < 0.62 ? 'expense' : kindRoll < 0.8 ? 'income' : 'transfer'
    const cats = CATEGORIES.filter((c) => INCOME_CATS.has(c) === (type === 'income'))
    const category = pick(rng, cats)
    const item = pick(rng, CATEGORY_ITEMS[category] as string[])
    const wallet = pick(rng, WALLETS)
    let other = pick(rng, WALLETS)
    while (other.name === wallet.name) other = pick(rng, WALLETS)
    const amount: Piece = { text: amountText(rng, type, category), entity: 'AMOUNT' }
    const walletPiece = (w: typeof wallet, entity: 'WALLET' | 'WALLET_TO'): Piece => ({ text: walletText(rng, w, noisy), entity })
    const cat: Piece = { text: item, entity: 'CAT' }
    const date = chance(rng, 0.12) ? pick(rng, DATE_PHRASES)[0] : ''
    const datePiece: Piece = { text: date, entity: 'DATE' }
    const filler = (): Piece => ({ text: pick(rng, FILLERS) })
    const person = (): Piece => ({ text: chance(rng, 0.15) ? pick(rng, PEOPLE) : '' })
    const withWallet = chance(rng, 0.55)
    let pieces: Piece[]

    if (type === 'transfer') {
      const withdraw = template % 3 === 0 && chance(rng, 0.4)
      const fee = chance(rng, 0.15) ? [{ text: pick(rng, ['with', 'plus', 'may', '+']) }, { text: String(pick(rng, [10, 15, 25, 50])), entity: 'FEE' as const }, { text: pick(rng, ['fee', 'charge', 'service fee']) }] : []
      if (withdraw) {
        pieces = pick(rng, [
          [{ text: pick(rng, WITHDRAW_VERBS) }, amount, walletPiece(wallet, 'WALLET')],
          [walletPiece(wallet, 'WALLET'), { text: 'atm' }, amount],
          [{ text: pick(rng, WITHDRAW_VERBS) }, { text: pick(rng, ['from', 'sa', '']) }, walletPiece(wallet, 'WALLET'), amount],
        ])
      } else {
        pieces = pick(rng, [
          [walletPiece(wallet, 'WALLET'), { text: pick(rng, ['to', '→', '->', 'papuntang', 'sa']) }, walletPiece(other, 'WALLET_TO'), amount],
          [{ text: pick(rng, TRANSFER_VERBS) }, amount, walletPiece(wallet, 'WALLET'), { text: pick(rng, ['to', 'papunta sa', '->']) }, walletPiece(other, 'WALLET_TO')],
          [{ text: pick(rng, TRANSFER_VERBS) }, amount, { text: pick(rng, ['from', 'mula sa', 'galing']) }, walletPiece(wallet, 'WALLET'), { text: pick(rng, ['to', 'sa', 'papuntang']) }, walletPiece(other, 'WALLET_TO')],
          [{ text: pick(rng, ['cash in', 'top up', 'load']) }, amount, walletPiece(other, 'WALLET_TO'), { text: pick(rng, ['from', 'via', 'gamit']) }, walletPiece(wallet, 'WALLET')],
          [{ text: pick(rng, ['savings', 'ipon', 'emergency fund', 'saved']) }, amount, { text: pick(rng, ['from', 'galing', 'via']) }, walletPiece(wallet, 'WALLET'), { text: chance(rng, 0.5) ? 'to' : '' }, { text: chance(rng, 0.5) ? walletText(rng, other, noisy) : '', entity: 'WALLET_TO' }],
          [{ text: pick(rng, ['paid', 'bayad', 'pay']) }, walletPiece(other, 'WALLET_TO'), amount, { text: pick(rng, ['from', 'via', 'gamit', 'thru']) }, walletPiece(wallet, 'WALLET')],
          [datePiece, amount, walletPiece(wallet, 'WALLET'), { text: 'to' }, walletPiece(other, 'WALLET_TO')],
        ])
        pieces = [...pieces, ...fee]
      }
    } else {
      const verb = { text: pick(rng, type === 'income' ? INCOME_VERBS : EXPENSE_VERBS) }
      const wp = withWallet ? walletPiece(wallet, 'WALLET') : { text: '' }
      const qn = String(pick(rng, [2, 3, 4, 5, 6]))
      const qtyStyle = rng()
      const qty: Piece[] = chance(rng, 0.12)
        ? qtyStyle < 0.4
          ? [{ text: qn, entity: 'QTY' }, { text: pick(rng, ['x', 'pcs', 'pieces', 'orders', 'tickets', 'pax']) }]
          : qtyStyle < 0.7
            ? [{ text: qn + 'x', entity: 'QTY' }]
            : [{ text: 'x' + qn, entity: 'QTY' }]
        : []
      const promo: Piece[] = chance(rng, 0.05) ? [{ text: pick(rng, ['2 for 1', 'buy 1 take 1', 'b1t1', '3 for 100', '50% off']) }] : []
      const share: Piece[] = chance(rng, 0.05) ? [{ text: pick(rng, ['total', 'bill', 'kabuuan']) }, { text: String(Math.floor(rng() * 3000 + 500)) }, { text: pick(rng, ['my share', 'share ko', 'akin', 'hati ko', 'ako lang']) }] : []
      const layouts: Piece[][] = [
        [verb, cat, amount, filler(), wp],
        [cat, amount, wp],
        [amount, { text: pick(rng, ['for', 'sa', 'pang', 'on', '']) }, cat, person(), wp],
        [verb, cat, person(), amount, { text: pick(rng, ['', 'cash', 'via', 'gamit', 'from', 'sa']) }, wp],
        [wp, amount, cat],
        [cat, wp, amount],
        [datePiece, cat, amount, wp],
        [cat, amount, datePiece],
        qtyStyle < 0.5 ? [verb, ...qty, cat, amount, wp] : [verb, cat, ...qty, amount, wp],
        share.length ? [verb, cat, ...share, amount] : [...promo, cat, { text: pick(rng, ['', '-', ':', '=']) }, amount],
      ]
      pieces = layouts[template] as Piece[]
      if (chance(rng, 0.1)) pieces = [...pieces, { text: pick(rng, ['note', 'napakamahal', 'sulit', 'worth it', 'sayang', 'finally', 'hehe', 'ugh']), entity: 'NOTE' }]
    }
    const built = build(rng, pieces, noisy)
    if (!built || options.exclude?.has(built.text.toLowerCase())) continue
    const ex: Example = { text: built.text, tags: built.tags, type }
    if (type !== 'transfer') ex.category = category
    out.push(ex)
  }
  return out
}
