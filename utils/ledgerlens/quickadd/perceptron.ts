/**
 * Averaged perceptron: a linear model that learns one weight per (feature, label). Small, fast,
 * dependency-free, and a known-good baseline for token tagging. The averaging keeps the weights
 * from being dominated by the last examples seen.
 */
export interface PerceptronModel {
  labels: string[]
  /** feature -> label -> weight; only non-zero weights are stored. */
  weights: Record<string, Record<string, number>>
}

export class AveragedPerceptron {
  private weights = new Map<string, Map<string, number>>()
  private totals = new Map<string, Map<string, number>>()
  private stamps = new Map<string, Map<string, number>>()
  private step = 0
  readonly labels: string[]

  constructor(labels: string[]) {
    this.labels = labels
  }

  scores(features: string[]): Map<string, number> {
    const s = new Map<string, number>(this.labels.map((l) => [l, 0]))
    for (const f of features) {
      const w = this.weights.get(f)
      if (!w) continue
      for (const [label, weight] of w) s.set(label, (s.get(label) ?? 0) + weight)
    }
    return s
  }

  predict(features: string[]): string {
    const s = this.scores(features)
    let best = this.labels[0] as string
    let bestScore = -Infinity
    for (const [label, score] of s) {
      if (score > bestScore) {
        best = label
        bestScore = score
      }
    }
    return best
  }

  update(truth: string, guess: string, features: string[]): void {
    this.step++
    if (truth === guess) return
    for (const f of features) {
      this.adjust(f, truth, 1)
      this.adjust(f, guess, -1)
    }
  }

  private adjust(feature: string, label: string, delta: number) {
    const w = this.weights.get(feature) ?? new Map<string, number>()
    const t = this.totals.get(feature) ?? new Map<string, number>()
    const s = this.stamps.get(feature) ?? new Map<string, number>()
    const current = w.get(label) ?? 0
    t.set(label, (t.get(label) ?? 0) + (this.step - (s.get(label) ?? 0)) * current)
    s.set(label, this.step)
    w.set(label, current + delta)
    this.weights.set(feature, w)
    this.totals.set(feature, t)
    this.stamps.set(feature, s)
  }

  /** Replaces the weights with their running averages. Call once, after the last epoch. */
  average(): void {
    for (const [feature, w] of this.weights) {
      const t = this.totals.get(feature) as Map<string, number>
      const s = this.stamps.get(feature) as Map<string, number>
      for (const [label, weight] of w) {
        const total = (t.get(label) ?? 0) + (this.step - (s.get(label) ?? 0)) * weight
        const avg = total / this.step
        if (Math.abs(avg) < 1e-6) w.delete(label)
        else w.set(label, Math.round(avg * 1000) / 1000)
      }
    }
  }

  toJSON(): PerceptronModel {
    const weights: PerceptronModel['weights'] = {}
    for (const [feature, w] of this.weights) {
      if (!w.size) continue
      weights[feature] = Object.fromEntries(w)
    }
    return { labels: this.labels, weights }
  }

  static fromJSON(model: PerceptronModel): AveragedPerceptron {
    const p = new AveragedPerceptron(model.labels)
    for (const [feature, w] of Object.entries(model.weights)) p.weights.set(feature, new Map(Object.entries(w)))
    return p
  }
}
