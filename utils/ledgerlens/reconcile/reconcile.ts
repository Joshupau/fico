import { formatAmount } from '../money/index'
import { signed, type Statement, type StatementRow } from '../statement/index'
import { amountErrorShape } from './shapes'
import type { Finding, Fix, Proposal, ReconcileReport } from './types'

const sameRow = (a: StatementRow, b: StatementRow, withBalance: boolean) =>
  a.date === b.date &&
  a.description === b.description &&
  a.direction === b.direction &&
  a.amountMinor === b.amountMinor &&
  (a.reference ?? '') === (b.reference ?? '') &&
  (!withBalance || a.balanceAfterMinor === b.balanceAfterMinor)

const lookalikeKey = (r: StatementRow) => [r.date, r.description, r.direction, r.amountMinor, r.reference ?? ''].join('\u0001')

function lookalikeGroups(rows: StatementRow[], exclude: Set<number>): number[][] {
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    if (exclude.has(row.line)) continue
    const key = lookalikeKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row.line])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}

function missingRowProposal(
  statement: Statement,
  signedAmount: number,
  beforeRow: StatementRow | null,
  date: string,
  balanceAfterMinor?: number
): Proposal {
  const money = formatAmount(Math.abs(signedAmount), statement.currency)
  const direction = signedAmount > 0 ? 'credit' : 'debit'
  const row: Extract<Fix, { type: 'insert_row' }>['row'] = {
    date,
    description: '(missing transaction)',
    direction,
    amountMinor: Math.abs(signedAmount),
  }
  if (balanceAfterMinor !== undefined) row.balanceAfterMinor = balanceAfterMinor
  return {
    kind: 'missing_row',
    message: beforeRow
      ? `A ${direction} of ${money} seems to be missing before line ${beforeRow.line}.`
      : `A ${direction} of ${money} seems to be missing at the end of the statement.`,
    fix: { type: 'insert_row', beforeLine: beforeRow?.line ?? null, row },
  }
}

function amountProposal(statement: Statement, row: StatementRow, rightMinor: number): Proposal {
  const shape = amountErrorShape(row.amountMinor, rightMinor)
  const why =
    shape === 'transposition' ? 'two digits look swapped' : shape === 'decimal_shift' ? 'the decimal point looks shifted' : shape === 'digit_substitution' ? 'one digit differs' : 'the amount does not fit the balance'
  return {
    kind: 'amount_error',
    shape,
    message: `Line ${row.line} says ${formatAmount(row.amountMinor, statement.currency)} but the balance fits ${formatAmount(rightMinor, statement.currency)} (${why}).`,
    fix: { type: 'set_amount', line: row.line, amountMinor: rightMinor },
  }
}

function totalsOf(statement: Statement) {
  let creditsMinor = 0
  let debitsMinor = 0
  for (const row of statement.rows) {
    if (row.direction === 'credit') creditsMinor += row.amountMinor
    else debitsMinor += row.amountMinor
  }
  return { creditsMinor, debitsMinor, netMinor: creditsMinor - debitsMinor }
}

/** Every row carries the statement's own running balance: each break can be pinned to a line. */
function reconcileRunning(statement: Statement): ReconcileReport {
  const { rows, currency } = statement
  const findings: Finding[] = []
  const notes: string[] = []
  const flagged = new Set<number>()
  const first = rows[0] as StatementRow

  let opening = statement.openingMinor
  if (opening === undefined) {
    opening = (first.balanceAfterMinor as number) - signed(first)
    notes.push('No opening balance was given, so it was worked out from the first row. The first row itself could not be checked.')
  }

  let previous = opening
  const kept: StatementRow[] = []
  for (const row of rows) {
    const balance = row.balanceAfterMinor as number
    const implied = balance - previous
    const actual = signed(row)
    if (implied === actual) {
      previous = balance
      kept.push(row)
      continue
    }

    // The same row, balance included, already appeared: the extraction repeated it.
    const twin = kept.find((k) => sameRow(k, row, true))
    if (twin) {
      findings.push({
        kind: 'duplicate_row',
        lines: [row.line, twin.line],
        deltaMinor: -actual,
        score: 0.95,
        message: `Line ${row.line} repeats line ${twin.line}, including its balance.`,
        fix: { type: 'remove_row', line: row.line },
        alternatives: [],
      })
      flagged.add(row.line)
      continue // the balance did not move, so `previous` stays
    }

    const delta = implied - actual
    const missing = missingRowProposal(statement, delta, row, row.date, balance - actual)
    let primary: Proposal
    let score: number
    const alternatives: Proposal[] = []

    if (implied === -actual) {
      primary = {
        kind: 'sign_flip',
        message: `Line ${row.line} is recorded as a ${row.direction} of ${formatAmount(row.amountMinor, currency)} but the balance moved the other way.`,
        fix: { type: 'flip_direction', line: row.line },
      }
      score = 0.9
      alternatives.push(missing)
    } else if (implied !== 0 && Math.sign(implied) === Math.sign(actual)) {
      const amount = amountProposal(statement, row, Math.abs(implied))
      if (amount.shape === 'transposition' || amount.shape === 'decimal_shift') {
        primary = amount
        score = 0.85
        alternatives.push(missing)
      } else {
        // A wrong amount and a dropped neighbour produce the same arithmetic. A dropped row is the
        // more common extraction fault, so it leads and the other explanation is kept beside it.
        primary = missing
        score = amount.shape === 'digit_substitution' ? 0.55 : 0.7
        alternatives.push(amount)
      }
    } else {
      primary = missing
      score = 0.6
    }

    findings.push({ ...primary, lines: [row.line], deltaMinor: delta, score, alternatives })
    flagged.add(row.line)
    previous = balance // trust the statement's balance and carry on
    kept.push(row)
  }

  const last = rows[rows.length - 1] as StatementRow
  if (statement.closingMinor !== undefined && statement.closingMinor !== previous) {
    const delta = statement.closingMinor - previous
    findings.push({
      ...missingRowProposal(statement, delta, null, last.date, statement.closingMinor),
      lines: [last.line],
      deltaMinor: delta,
      score: 0.6,
      alternatives: [],
    })
    notes.push('The last row does not reach the closing balance. Check the closing balance you entered as well.')
  }

  const totals = totalsOf(statement)
  const closing = statement.closingMinor ?? (last.balanceAfterMinor as number)
  const deltaMinor = closing - opening - totals.netMinor
  const report: ReconcileReport = {
    mode: 'running_balance',
    status: findings.length ? 'needs_review' : 'balanced',
    totals: { ...totals, openingMinor: opening, closingMinor: closing, deltaMinor },
    findings,
    compensating: findings.length > 0 && deltaMinor === 0,
    lookalikes: lookalikeGroups(rows, flagged),
    notes,
  }
  if (report.compensating) notes.push('The totals agree, but individual rows do not. These errors cancel each other out and a totals check alone would miss them.')
  return report
}

/** Only opening and closing balances are known: one delta, ranked explanations. */
function reconcileTotals(statement: Statement, opening: number, closing: number): ReconcileReport {
  const { rows } = statement
  const totals = totalsOf(statement)
  const delta = closing - opening - totals.netMinor
  const notes = ['This statement has no running balance column, so only the totals can be checked. Errors that cancel each other out cannot be seen.']
  const findings: Finding[] = []

  if (delta !== 0) {
    const groups = lookalikeGroups(rows, new Set())
    const byLine = new Map(rows.map((r) => [r.line, r]))
    for (const group of groups) {
      const lastLine = group[group.length - 1] as number
      const row = byLine.get(lastLine) as StatementRow
      if (-signed(row) === delta) {
        findings.push({
          kind: 'duplicate_row',
          lines: [...group].reverse(),
          deltaMinor: delta,
          score: row.reference ? 0.9 : 0.8,
          message: `Lines ${group.join(' and ')} look identical, and removing one makes the totals agree.`,
          fix: { type: 'remove_row', line: lastLine },
          alternatives: [],
        })
      }
    }

    const flips = rows.filter((r) => -2 * signed(r) === delta)
    for (const row of flips) {
      findings.push({
        kind: 'sign_flip',
        lines: [row.line],
        deltaMinor: delta,
        score: flips.length === 1 ? 0.7 : 0.5,
        message: `If line ${row.line} is really a ${row.direction === 'credit' ? 'debit' : 'credit'}, the totals agree.`,
        fix: { type: 'flip_direction', line: row.line },
        alternatives: [],
      })
    }

    for (const row of rows) {
      const right = signed(row) + delta
      if (right === 0 || Math.sign(right) !== Math.sign(signed(row))) continue
      const proposal = amountProposal(statement, row, Math.abs(right))
      if (proposal.shape === 'transposition' || proposal.shape === 'decimal_shift') {
        findings.push({ ...proposal, lines: [row.line], deltaMinor: delta, score: 0.5, alternatives: [] })
      }
    }

    const last = rows[rows.length - 1] as StatementRow
    findings.push({
      ...missingRowProposal(statement, delta, null, last.date),
      lines: [],
      deltaMinor: delta,
      score: findings.length ? 0.3 : 0.5,
      message: `A ${delta > 0 ? 'credit' : 'debit'} of ${formatAmount(Math.abs(delta), statement.currency)} seems to be missing somewhere in the statement.`,
      alternatives: [],
    })
    findings.sort((a, b) => b.score - a.score)
  }

  return {
    mode: 'totals_only',
    status: delta === 0 ? 'balanced' : 'needs_review',
    totals: { ...totals, openingMinor: opening, closingMinor: closing, deltaMinor: delta },
    findings,
    compensating: false,
    lookalikes: lookalikeGroups(rows, new Set()),
    notes,
  }
}

/**
 * Checks a statement's arithmetic. It never changes the statement: every finding carries a
 * proposed fix for a person to accept, edit or reject.
 */
export function reconcile(statement: Statement): ReconcileReport {
  const { rows } = statement
  for (const row of rows) {
    if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor < 0) throw new RangeError(`line ${row.line}: amount must be a non-negative integer of minor units`)
  }
  if (rows.length && rows.every((r) => r.balanceAfterMinor !== undefined)) return reconcileRunning(statement)
  if (statement.openingMinor !== undefined && statement.closingMinor !== undefined) {
    return reconcileTotals(statement, statement.openingMinor, statement.closingMinor)
  }
  const notes = ['Nothing to check against: the statement has no running balance column and no opening and closing balances were given.']
  if (rows.some((r) => r.balanceAfterMinor !== undefined)) notes.push('Some rows have a balance and some do not, so the running balance could not be used.')
  return {
    mode: 'unverifiable',
    status: 'unverifiable',
    totals: totalsOf(statement),
    findings: [],
    compensating: false,
    lookalikes: lookalikeGroups(rows, new Set()),
    notes,
  }
}
