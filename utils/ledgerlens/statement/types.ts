export type Direction = 'credit' | 'debit'

export interface StatementRow {
  /** 1-based line in the source file (the header is line 1). Stable across fixes. */
  line: number
  /** YYYY-MM-DD as written in the statement. No time zone conversion is applied. */
  date: string
  description: string
  direction: Direction
  /** Non-negative minor units. The direction carries the sign. */
  amountMinor: number
  /** The statement's own running balance after this row, when it prints one. */
  balanceAfterMinor?: number
  reference?: string
}

export interface Statement {
  account: string
  currency: string
  openingMinor?: number
  closingMinor?: number
  rows: StatementRow[]
}

/** +amount for a credit, -amount for a debit. */
export const signed = (row: Pick<StatementRow, 'direction' | 'amountMinor'>): number =>
  row.direction === 'credit' ? row.amountMinor : -row.amountMinor
