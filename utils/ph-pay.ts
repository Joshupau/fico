// Philippine pay maths: take-home pay, 13th month, leave value and freelancer tax. Estimates only,
// using the rates in force for 2025 (TRAIN income tax from 2023, SSS 15% with a ₱35,000 MSC cap,
// PhilHealth 5% on ₱10,000 to ₱100,000, Pag-IBIG 2% on up to ₱10,000). Tested in scripts/test-ph-pay.mts.

const round2 = (n: number) => Math.round(n * 100) / 100

/** Annual income tax on taxable income (TRAIN graduated rates, 2023 onward). */
export function incomeTax(annualTaxable: number): number {
  const x = Math.max(0, annualTaxable)
  if (x <= 250_000) return 0
  if (x <= 400_000) return round2((x - 250_000) * 0.15)
  if (x <= 800_000) return round2(22_500 + (x - 400_000) * 0.2)
  if (x <= 2_000_000) return round2(102_500 + (x - 800_000) * 0.25)
  if (x <= 8_000_000) return round2(402_500 + (x - 2_000_000) * 0.3)
  return round2(2_202_500 + (x - 8_000_000) * 0.35)
}

/** SSS monthly salary credit: the salary rounded into ₱500 steps, from ₱5,000 to ₱35,000. */
export function sssCredit(monthly: number): number {
  if (monthly < 5_250) return 5_000
  if (monthly >= 34_750) return 35_000
  return Math.round(monthly / 500) * 500
}

export interface Contributions {
  sss: number
  philhealth: number
  pagibig: number
  total: number
}

/** What an employee pays each month (the employer pays its own share on top). */
export function employeeContributions(monthly: number): Contributions {
  const sss = round2(sssCredit(monthly) * 0.05)
  const philhealth = round2(Math.min(100_000, Math.max(10_000, monthly)) * 0.025)
  const pagibig = round2(Math.min(monthly, 10_000) * (monthly <= 1_500 ? 0.01 : 0.02))
  return { sss, philhealth, pagibig, total: round2(sss + philhealth + pagibig) }
}

/** What a self-employed person pays each month: both halves of SSS and PhilHealth, ₱200 Pag-IBIG. */
export function selfEmployedContributions(monthly: number): Contributions {
  const sss = round2(sssCredit(monthly) * 0.15)
  const philhealth = round2(Math.min(100_000, Math.max(10_000, monthly)) * 0.05)
  const pagibig = 200
  return { sss, philhealth, pagibig, total: round2(sss + philhealth + pagibig) }
}

export interface TakeHome {
  gross: number
  contributions: Contributions
  tax: number
  net: number
}

/** Monthly take-home pay for an employee on a fixed monthly salary. */
export function takeHome(monthlyGross: number): TakeHome {
  const contributions = employeeContributions(monthlyGross)
  const taxable = Math.max(0, monthlyGross - contributions.total)
  const tax = round2(incomeTax(taxable * 12) / 12)
  return { gross: monthlyGross, contributions, tax, net: round2(monthlyGross - contributions.total - tax) }
}

/** 13th month pay and other benefits are tax free up to this much a year. */
export const BENEFITS_EXEMPT = 90_000
/** Working days a year for a five-day week, used to turn a monthly salary into a daily rate. */
export const WORK_DAYS = 261

export const dailyRate = (monthly: number, workDays = WORK_DAYS) => round2((monthly * 12) / workDays)

export interface ThirteenthMonth {
  /** Basic salary actually earned this year, after unpaid leave. */
  earned: number
  amount: number
  /** The part above the ₱90,000 exemption (with other benefits), which is taxed. */
  taxable: number
  /** Taken off for unpaid leave. */
  leaveCut: number
}

/** 13th month pay: a twelfth of the basic salary earned in the year. Unpaid leave lowers it. */
export function thirteenthMonth(input: { monthlyBasic: number; monthsWorked: number; unpaidLeaveDays?: number; otherBenefits?: number }): ThirteenthMonth {
  const months = Math.min(12, Math.max(0, input.monthsWorked))
  const leaveCut = round2(dailyRate(input.monthlyBasic) * Math.max(0, input.unpaidLeaveDays ?? 0))
  const earned = Math.max(0, round2(input.monthlyBasic * months - leaveCut))
  const amount = round2(earned / 12)
  const taxable = round2(Math.max(0, amount + Math.max(0, input.otherBenefits ?? 0) - BENEFITS_EXEMPT))
  return { earned, amount, taxable, leaveCut }
}

/** Leave left and what it is worth at your daily rate (if your employer converts it to cash). */
export function leaveValue(input: { credits: number; used: number; monthly: number }) {
  const left = Math.max(0, input.credits - input.used)
  return { left, worth: round2(left * dailyRate(input.monthly)) }
}

export interface FreelancerTax {
  gross: number
  /** 8% on gross above ₱250,000, in place of income and percentage tax. Only up to ₱3M gross. */
  eightPercent: number | null
  /** Graduated rates on 60% of gross (the 40% optional standard deduction), plus 3% percentage tax. */
  graduated: number
  best: 'eight' | 'graduated'
}

/** A year's income tax for a self-employed person or freelancer, both ways. */
export function freelancerTax(annualGross: number): FreelancerTax {
  const gross = Math.max(0, annualGross)
  const eightPercent = gross <= 3_000_000 ? round2(Math.max(0, gross - 250_000) * 0.08) : null
  const graduated = round2(incomeTax(gross * 0.6) + gross * 0.03)
  return { gross, eightPercent, graduated, best: eightPercent !== null && eightPercent <= graduated ? 'eight' : 'graduated' }
}

/** BIR filing dates for a freelancer: three quarterly returns and the annual one in April. */
export function filingDeadlines(year: number): { label: string; date: Date }[] {
  return [
    { label: `Annual return for ${year - 1} (1701/1701A)`, date: new Date(year, 3, 15) },
    { label: `Q1 ${year} (1701Q)`, date: new Date(year, 4, 15) },
    { label: `Q2 ${year} (1701Q)`, date: new Date(year, 7, 15) },
    { label: `Q3 ${year} (1701Q)`, date: new Date(year, 10, 15) },
  ]
}

/** The next filing date on or after today (rolls into next year after November). */
export function nextFilingDeadline(today: Date): { label: string; date: Date } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const all = [...filingDeadlines(today.getFullYear()), ...filingDeadlines(today.getFullYear() + 1)]
  return all.find((d) => d.date >= start)!
}
