/**
 * A small quick-add tagger: labels each token (amount, wallet, category cue, quantity, date, fee)
 * and classifies the message type. Trained with an averaged perceptron; the whole model is JSON.
 */
import { messageFeatures, tokenFeatures } from './features'
import { AveragedPerceptron, type PerceptronModel } from './perceptron'
import { tokenize, type Token } from './tokenize'

export const ENTITY_TYPES = ['AMOUNT', 'WALLET', 'WALLET_TO', 'CAT', 'DATE', 'QTY', 'FEE', 'NOTE'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]
export const TAGS = ['O', ...ENTITY_TYPES.flatMap((e) => [`B-${e}`, `I-${e}`])]
export const MESSAGE_TYPES = ['expense', 'income', 'transfer'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export interface Example {
  text: string
  /** One tag per token of `tokenize(text)`. */
  tags: string[]
  type: MessageType
  /** Category name for the CAT span, when known. */
  category?: string
}

export interface TaggerModel {
  version: 1
  tagger: PerceptronModel
  typer: PerceptronModel
  categorizer: PerceptronModel
}

export interface Span {
  entity: EntityType
  text: string
  tokens: Token[]
}

export interface Tagged {
  tokens: Token[]
  tags: string[]
  spans: Span[]
  type: MessageType
  typeMargin: number
  category?: string
  categoryMargin: number
}

const categoryFeatures = (span: string, type: MessageType): string[] => {
  const words = span.toLowerCase().split(/\s+/)
  const f = ['b', 'type=' + type]
  for (const w of words) {
    f.push('w=' + w, 'p4=' + w.slice(0, 4), 's3=' + w.slice(-3))
    const padded = `#${w}#`
    for (let k = 0; k + 3 <= padded.length; k++) f.push('c3=' + padded.slice(k, k + 3))
  }
  return f
}

const margin = (scores: Map<string, number>, winner: string) => {
  const w = scores.get(winner) ?? 0
  let second = -Infinity
  for (const [l, s] of scores) if (l !== winner && s > second) second = s
  return second === -Infinity ? w : w - second
}

export function spansFrom(tokens: Token[], tags: string[]): Span[] {
  const spans: Span[] = []
  let current: Span | null = null
  tags.forEach((tag, i) => {
    const token = tokens[i] as Token
    if (tag === 'O') {
      current = null
      return
    }
    const entity = tag.slice(2) as EntityType
    if (tag.startsWith('B-') || !current || current.entity !== entity) {
      current = { entity, text: token.text, tokens: [token] }
      spans.push(current)
    } else {
      current.tokens.push(token)
      current.text += ' ' + token.text
    }
  })
  return spans
}

export class Tagger {
  constructor(
    private tagger: AveragedPerceptron,
    private typer: AveragedPerceptron,
    private categorizer: AveragedPerceptron
  ) {}

  tag(text: string): Tagged {
    const tokens = tokenize(text)
    const tags: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      tags.push(this.tagger.predict(tokenFeatures(tokens, i, tags[i - 1] ?? '<s>', tags[i - 2] ?? '<s>')))
    }
    const spans = spansFrom(tokens, tags)
    const typeScores = this.typer.scores(messageFeatures(tokens, tags))
    const type = this.typer.predict(messageFeatures(tokens, tags)) as MessageType
    const cat = spans.find((s) => s.entity === 'CAT')
    let category: string | undefined
    let categoryMargin = 0
    if (cat) {
      const feats = categoryFeatures(cat.text, type)
      category = this.categorizer.predict(feats)
      categoryMargin = margin(this.categorizer.scores(feats), category)
    }
    const result: Tagged = { tokens, tags, spans, type, typeMargin: margin(typeScores, type), categoryMargin }
    if (category) result.category = category
    return result
  }

  toJSON(): TaggerModel {
    return { version: 1, tagger: this.tagger.toJSON(), typer: this.typer.toJSON(), categorizer: this.categorizer.toJSON() }
  }

  static fromJSON(model: TaggerModel): Tagger {
    return new Tagger(AveragedPerceptron.fromJSON(model.tagger), AveragedPerceptron.fromJSON(model.typer), AveragedPerceptron.fromJSON(model.categorizer))
  }
}

export interface TrainOptions {
  epochs?: number
  seed?: number
  categories: string[]
  onEpoch?: (epoch: number, tokenErrors: number, typeErrors: number) => void
}

/** Trains on examples whose tags line up with `tokenize(text)`. Shuffles each epoch with a seeded RNG. */
export function train(examples: Example[], options: TrainOptions): Tagger {
  const epochs = options.epochs ?? 8
  let seed = (options.seed ?? 1) >>> 0
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const tagger = new AveragedPerceptron(TAGS)
  const typer = new AveragedPerceptron([...MESSAGE_TYPES])
  const categorizer = new AveragedPerceptron(options.categories)
  const data = examples.map((e) => ({ ...e, tokens: tokenize(e.text) })).filter((e) => e.tokens.length === e.tags.length)

  for (let epoch = 1; epoch <= epochs; epoch++) {
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[data[i], data[j]] = [data[j] as never, data[i] as never]
    }
    let tokenErrors = 0
    let typeErrors = 0
    for (const ex of data) {
      const guessed: string[] = []
      for (let i = 0; i < ex.tokens.length; i++) {
        // Features use the model's own previous guesses so training matches prediction.
        const feats = tokenFeatures(ex.tokens, i, guessed[i - 1] ?? '<s>', guessed[i - 2] ?? '<s>')
        const guess = tagger.predict(feats)
        const truth = ex.tags[i] as string
        tagger.update(truth, guess, feats)
        if (guess !== truth) tokenErrors++
        guessed.push(guess)
      }
      const mf = messageFeatures(ex.tokens, ex.tags)
      const typeGuess = typer.predict(mf)
      typer.update(ex.type, typeGuess, mf)
      if (typeGuess !== ex.type) typeErrors++
      const cat = spansFrom(ex.tokens, ex.tags).find((s) => s.entity === 'CAT')
      if (cat && ex.category) {
        const cf = categoryFeatures(cat.text, ex.type)
        categorizer.update(ex.category, categorizer.predict(cf), cf)
      }
    }
    options.onEpoch?.(epoch, tokenErrors, typeErrors)
  }
  tagger.average()
  typer.average()
  categorizer.average()
  return new Tagger(tagger, typer, categorizer)
}
