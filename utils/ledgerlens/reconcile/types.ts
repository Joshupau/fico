import type { Direction, Statement, StatementRow } from '../statement/index'

export type FindingKind = 'missing_row' | 'duplicate_row' | 'sign_flip' | 'amount_error'

export type AmountErrorShape = 'transposition' | 'decimal_shift' | 'digit_substitution' | 'other'

/** A change a person can approve. Nothing is applied until `applyFix` is called. */
export type Fix =
  | { type: 'remove_row'; line: number }
  | { type: 'flip_direction'; line: number }
  | { type: 'set_amount'; line: number; amountMinor: number }
  | {
      type: 'insert_row'
      /** Insert before this line, or at the end when null. */
      beforeLine: number | null
      row: { date: string; description: string; direction: Direction; amountMinor: number; balanceAfterMinor?: number }
    }

export interface Proposal {
  kind: FindingKind
  /** Plain-language explanation with the amounts involved. */
  message: string
  fix: Fix
  shape?: AmountErrorShape
}

export interface Finding extends Proposal {
  /** Source lines the finding points at. */
  lines: number[]
  /** How far the arithmetic is off at this point, in minor units (statement minus extracted rows). */
  deltaMinor: number
  /** A ranking score from 0 to 1. It orders proposals; it is not a probability. */
  score: number
  /** Other explanations that fit the same arithmetic, best first. */
  alternatives: Proposal[]
}

export type ReconcileMode = 'running_balance' | 'totals_only' | 'unverifiable'

export interface ReconcileReport {
  mode: ReconcileMode
  status: 'balanced' | 'needs_review' | 'unverifiable'
  totals: {
    openingMinor?: number
    closingMinor?: number
    creditsMinor: number
    debitsMinor: number
    netMinor: number
    /** Statement movement minus the movement of the extracted rows. 0 means the totals agree. */
    deltaMinor?: number
  }
  /**
   * running_balance: independent findings, one per place the balance breaks.
   * totals_only: ranked alternative explanations for one delta; at most one is true.
   */
  findings: Finding[]
  /** True when the totals agree but individual rows do not: errors that cancel each other out. */
  compensating: boolean
  /** Groups of lines that look identical. Informational; never removed automatically. */
  lookalikes: number[][]
  notes: string[]
}

export interface AuditEntry {
  fix: Fix
  approvedBy: string
  at: string
  before: StatementRow | null
  after: StatementRow | null
}

export interface ApplyResult {
  statement: Statement
  audit: AuditEntry
}
