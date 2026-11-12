// Checks an imported statement's arithmetic before the rows are saved.
//
// The check itself lives in utils/ledgerlens (copied from the LedgerLens repo). This file maps its
// findings onto Fico's import rows: a fix the user accepts changes the rows that will be imported;
// a fix they skip changes nothing. Money is handled in centavos until the final conversion.
import type { ImportRow } from './import-csv'
import {
  applyFix,
  parseAmount,
  parseStatementCsv,
  reconcile,
  toDecimalString,
  type Finding,
  type Fix,
  type ReconcileReport,
  type Statement,
} from './ledgerlens'

export interface ReconcileCheck {
  report: ReconcileReport
  statement: Statement
  /** Lines the importer rejected that the reconciler could still read, or the other way round. */
  rejectedLines: number[]
}

export interface BalanceHints {
  /** Opening and closing balances typed by the user, in major units ("10,000.00"). Optional. */
  opening?: string
  closing?: string
}

const majorToMinor = (text: string | undefined, currency: string): number | undefined => {
  if (!text?.trim()) return undefined
  const r = parseAmount(text, currency)
  return r.ok ? r.minor : undefined
}

/**
 * Runs the arithmetic check on the raw CSV. Returns null when the file is not a statement the
 * reconciler can read (the import then goes ahead unchecked, and the UI says so).
 */
export function checkStatement(csvText: string, currency: string, hints: BalanceHints = {}): ReconcileCheck | null {
  const options: Parameters<typeof parseStatementCsv>[1] = { currency }
  const opening = majorToMinor(hints.opening, currency)
  const closing = majorToMinor(hints.closing, currency)
  if (opening !== undefined) options.openingMinor = opening
  if (closing !== undefined) options.closingMinor = closing
  const parsed = parseStatementCsv(csvText, options)
  if (!parsed.ok) return null
  return {
    report: reconcile(parsed.statement),
    statement: parsed.statement,
    rejectedLines: parsed.rejected.map((r) => r.line),
  }
}

export type Decision = { fix: Fix; approvedBy: string }

/** Applies the fixes the user accepted to the statement and returns the audit trail. */
export function applyDecisions(statement: Statement, decisions: Decision[], at: string) {
  let current = statement
  const audit: ReturnType<typeof applyFix>['audit'][] = []
  for (const d of decisions) {
    const result = applyFix(current, d.fix, { approvedBy: d.approvedBy, at })
    current = result.statement
    audit.push(result.audit)
  }
  return { statement: current, audit }
}

/**
 * Carries accepted fixes over to the rows the importer produced, so categories, tags and dates the
 * importer already worked out are kept. Rows are matched by file line.
 */
export function applyFixesToImportRows(rows: ImportRow[], fixes: Fix[], currency: string): ImportRow[] {
  let next = rows.map((r) => ({ ...r }))
  for (const fix of fixes) {
    switch (fix.type) {
      case 'remove_row':
        next = next.filter((r) => r.line !== fix.line)
        break
      case 'flip_direction':
        next = next.map((r) => (r.line === fix.line ? { ...r, type: r.type === 'income' ? 'expense' : 'income' } : r))
        break
      case 'set_amount':
        next = next.map((r) => (r.line === fix.line ? { ...r, amount: Number(toDecimalString(fix.amountMinor, currency)) } : r))
        break
      case 'insert_row': {
        const row: ImportRow = {
          line: Math.max(1, ...next.map((r) => r.line)) + 1,
          date: new Date(`${fix.row.date}T00:00:00.000Z`).toISOString(),
          amount: Number(toDecimalString(fix.row.amountMinor, currency)),
          type: fix.row.direction === 'credit' ? 'income' : 'expense',
          description: fix.row.description,
          tags: ['reconciled'],
          category_id: null,
        }
        const at = fix.beforeLine === null ? next.length : next.findIndex((r) => r.line === fix.beforeLine)
        next.splice(at < 0 ? next.length : at, 0, row)
        break
      }
    }
  }
  return next
}

/** A short, plain label for a finding in the review list. */
export function findingTitle(f: Finding): string {
  switch (f.kind) {
    case 'missing_row':
      return 'A transaction seems to be missing'
    case 'duplicate_row':
      return 'A row appears twice'
    case 'sign_flip':
      return 'Money went the other way'
    case 'amount_error':
      return 'An amount does not fit the balance'
  }
}

export function statusLabel(report: ReconcileReport): { title: string; detail: string; tone: 'ok' | 'warn' | 'muted' } {
  if (report.status === 'balanced') {
    return {
      title: 'The statement adds up',
      detail: report.mode === 'running_balance' ? 'Every row matches the running balance.' : 'Opening + credits − debits = closing. Rows were not checked one by one.',
      tone: 'ok',
    }
  }
  if (report.status === 'needs_review') {
    const n = report.findings.length
    return { title: `${n} thing${n === 1 ? '' : 's'} to look at`, detail: report.compensating ? 'The totals agree but some rows do not.' : 'The rows do not reach the balance on the statement.', tone: 'warn' }
  }
  return { title: 'Nothing to check against', detail: 'Add the opening and closing balance from the statement to check it.', tone: 'muted' }
}
