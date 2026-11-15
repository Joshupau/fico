// Quick-add: the rules parser first, the small on-device tagger second.
//
// The tagger (utils/ledgerlens/quickadd, copied from the LedgerLens repo) only fills in what the
// rules left empty or defaulted, and every change it makes is listed in `evidence`. The model file
// is loaded once, lazily, so it is not in the first bundle; if it fails to load for any reason the
// rules parser answers alone, exactly as before.
import { parseTransactionText, type ParseContext, type ParsedTransaction } from './transaction-parser'
import { combine, decode, Tagger, type QuickAddContext } from './ledgerlens'

let taggerPromise: Promise<Tagger | null> | null = null

function loadTagger(): Promise<Tagger | null> {
  if (!taggerPromise) {
    taggerPromise = import('./ledgerlens/quickadd-tagger.json')
      .then((m) => Tagger.fromJSON((m.default ?? m) as never))
      .catch((err) => {
        console.warn('[quickadd] tagger unavailable, rules only:', err)
        return null
      })
  }
  return taggerPromise
}

/** Call early (for example when the agent sheet opens) so the first message does not wait. */
export function warmQuickAdd(): void {
  void loadTagger()
}

export type QuickAddParsed = ParsedTransaction & { evidence?: string[] }

export async function parseQuickAdd(text: string, context: ParseContext): Promise<QuickAddParsed> {
  const rules = parseTransactionText(text, context)
  const tagger = await loadTagger()
  if (!tagger) return rules
  const ctx: QuickAddContext = {
    wallets: (context.wallets ?? []).map((w) => (typeof w === 'string' ? { name: w } : { name: w.name, ...(w.type ? { type: w.type } : {}) })),
    categories: (context.categories ?? []).map((c) => ({ name: c.name, ...(c.type ? { type: c.type } : {}) })),
    now: context.now ?? new Date(),
  }
  try {
    const guess = decode(tagger.tag(text), ctx)
    const merged = combine(rules, guess)
    return { ...rules, ...merged }
  } catch (err) {
    console.warn('[quickadd] tagger failed on this message, rules only:', err)
    return rules
  }
}
