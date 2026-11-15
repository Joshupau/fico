/**
 * Splits a quick-add message into tokens. Letters and digits are split apart ("lunch150" becomes
 * "lunch", "150") because that is one of the rules parser's known blind spots; amounts keep their
 * inner punctuation ("1,250.50", "1.2k", "7-11").
 */
export interface Token {
  text: string
  /** Character offset in the original message. */
  start: number
  end: number
}

const AMOUNT_LIKE = /^(?:₱|php|p)?\d[\d,]*(?:\.\d+)?k?$/i

export function tokenize(message: string): Token[] {
  const out: Token[] = []
  const re = /₱?\d[\d,]*(?:\.\d+)?(?:k(?![a-z]))?|[a-zÀ-ɏ]+(?:'[a-z]+)?|[^\s\w]/giu
  let m: RegExpExecArray | null
  while ((m = re.exec(message))) {
    const text = m[0]
    // "7-11" / "7-eleven": glue a lone digit-dash-word back together as one token.
    const prev = out[out.length - 1]
    if (text === '-' && prev && /^\d+$/.test(prev.text) && message[m.index + 1] && /[\da-z]/i.test(message[m.index + 1] as string)) {
      const rest = /^[\da-z]+/i.exec(message.slice(m.index + 1))
      if (rest) {
        prev.text += '-' + rest[0]
        prev.end = m.index + 1 + rest[0].length
        re.lastIndex = prev.end
        continue
      }
    }
    out.push({ text, start: m.index, end: m.index + text.length })
  }
  return out
}

export const looksLikeAmount = (text: string) => AMOUNT_LIKE.test(text)
