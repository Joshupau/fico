// Philippine pay maths, against hand-worked numbers. Run: npx tsx scripts/test-ph-pay.mts
import { employeeContributions, freelancerTax, incomeTax, leaveValue, nextFilingDeadline, selfEmployedContributions, sssCredit, takeHome, thirteenthMonth } from '../utils/ph-pay'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

// Income tax brackets.
check('tax: 250k is exempt', incomeTax(250_000) === 0)
check('tax: 300k', incomeTax(300_000) === 7_500, incomeTax(300_000))
check('tax: 500k', incomeTax(500_000) === 42_500, incomeTax(500_000))
check('tax: 1M', incomeTax(1_000_000) === 152_500, incomeTax(1_000_000))

// SSS credit steps.
check('sss credit rounds to 500', sssCredit(20_240) === 20_000 && sssCredit(20_300) === 20_500, [sssCredit(20_240), sssCredit(20_300)])
check('sss credit floor and cap', sssCredit(4_000) === 5_000 && sssCredit(40_000) === 35_000)

// ₱30,000 a month: SSS 1,500, PhilHealth 750, Pag-IBIG 200.
const c = employeeContributions(30_000)
check('employee contributions', c.sss === 1_500 && c.philhealth === 750 && c.pagibig === 200 && c.total === 2_450, c)
// Taxable 27,550 × 12 = 330,600 → (80,600 × 15%) / 12 = 1,007.50; net 26,542.50.
const t = takeHome(30_000)
check('take-home', t.tax === 1_007.5 && t.net === 26_542.5, t)
check('self-employed contributions', selfEmployedContributions(30_000).total === 4_500 + 1_500 + 200, selfEmployedContributions(30_000))

// 13th month.
check('13th month, full year', thirteenthMonth({ monthlyBasic: 30_000, monthsWorked: 12 }).amount === 30_000)
check('13th month, 7 months', thirteenthMonth({ monthlyBasic: 30_000, monthsWorked: 7 }).amount === 17_500)
// Daily rate 360,000 / 261 = 1,379.31; 3 days = 4,137.93 off; (360,000 − 4,137.93) / 12 = 29,655.17.
const leave = thirteenthMonth({ monthlyBasic: 30_000, monthsWorked: 12, unpaidLeaveDays: 3 })
check('13th month, unpaid leave', leave.leaveCut === 4_137.93 && leave.amount === 29_655.17, leave)
check('13th month over the 90k exemption', thirteenthMonth({ monthlyBasic: 30_000, monthsWorked: 12, otherBenefits: 70_000 }).taxable === 10_000)
check('leave value', leaveValue({ credits: 15, used: 5, monthly: 30_000 }).worth === 13_793.1, leaveValue({ credits: 15, used: 5, monthly: 30_000 }))

// Freelancer: 600k gross → 8% of 350k = 28,000; graduated on 360k = 16,500 + 3% of 600k = 18,000 → 34,500.
const f = freelancerTax(600_000)
check('freelancer 8% vs graduated', f.eightPercent === 28_000 && f.graduated === 34_500 && f.best === 'eight', f)
const big = freelancerTax(3_500_000)
check('over 3M has no 8% option', big.eightPercent === null && big.graduated === 537_500 && big.best === 'graduated', big)

// Filing deadlines.
check('next deadline in November', nextFilingDeadline(new Date(2026, 10, 7)).date.getTime() === new Date(2026, 10, 15).getTime())
const after = nextFilingDeadline(new Date(2026, 10, 20))
check('after Q3 it is next April', after.date.getTime() === new Date(2027, 3, 15).getTime() && after.label.includes('2026'), after)

if (failures) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL PASSED')
