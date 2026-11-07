'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { format, startOfYear } from 'date-fns'
import toast from 'react-hot-toast'
import { CalendarCheck, Gift, Plane, Receipt, Wallet } from 'lucide-react'
import { ManageHeader } from '@/components/page/manage-header'
import { fieldClass } from '@/components/ui/form-sheet'
import { useListTransactions } from '@/queries/user/transaction/transaction'
import { useCreatePlannedItem, useListPlannedItems, useUpdatePlannedItem } from '@/queries/user/planned/planned-items'
import { usePayStore, type PayMode } from '@/store/pay-store'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { cn } from '@/lib/utils'
import { freelancerTax, leaveValue, nextFilingDeadline, selfEmployedContributions, takeHome, thirteenthMonth, BENEFITS_EXEMPT } from '@/utils/ph-pay'

/* eslint-disable @typescript-eslint/no-explicit-any */
const asList = (data: any): any[] => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])
/* eslint-enable @typescript-eslint/no-explicit-any */

const MODES: { value: PayMode; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'freelancer', label: 'Freelancer' },
]
const THIRTEENTH_NAME = '13th month pay'

function Section({ icon: Icon, title, tone, children }: { icon: typeof Wallet; title: string; tone: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-ios sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="relative block">
        <input
          inputMode="decimal"
          value={value ? String(value) : ''}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
          className={cn(fieldClass, 'tabular-nums', suffix && 'pr-14')}
        />
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  )
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'font-heading text-lg font-semibold text-foreground' : 'font-medium text-foreground', tone)}>{value}</dd>
    </div>
  )
}

/** Manage > Pay & taxes: take-home pay, 13th month, leave, and freelancer tax, with Philippine rates. */
export default function PayPage() {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const [showAmounts, setShowAmounts] = useState(!hideAmountsOnOpen)
  const money = (n: number) => formatMoney(n, currency, !showAmounts)
  const pay = usePayStore()
  const today = useMemo(() => new Date(), [])
  const monthsSoFar = today.getMonth() + 1

  // Employee.
  const salary = takeHome(pay.monthlyBasic)
  const monthsWorked = Math.max(0, 13 - Math.max(1, Math.min(12, pay.startMonth)))
  const thirteenth = thirteenthMonth({ monthlyBasic: pay.monthlyBasic, monthsWorked, unpaidLeaveDays: pay.unpaidLeaveDays, otherBenefits: pay.otherBenefits })
  const leave = leaveValue({ credits: pay.leaveCredits, used: pay.leaveUsed, monthly: pay.monthlyBasic })

  // Freelancer.
  const tax = freelancerTax(pay.freelanceGross)
  const monthlyContrib = selfEmployedContributions(pay.freelanceGross / 12)
  const deadline = nextFilingDeadline(today)
  const { data: incomeResponse } = useListTransactions({ type: 'income', startDate: startOfYear(today).toISOString(), limit: '2000' })
  const incomeSoFar = useMemo(
    () => asList(incomeResponse?.data).filter((t) => t.type === 'income' && !t.obligationId && t.status !== 'pending').reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [incomeResponse]
  )

  // 13th month as a planned income in December.
  const { data: planned } = useListPlannedItems()
  const create = useCreatePlannedItem()
  const update = useUpdatePlannedItem()
  const payDate = `${today.getFullYear()}-12-15`
  const existing = (planned ?? []).find((p) => p.name === THIRTEENTH_NAME && p.date.startsWith(String(today.getFullYear())))
  const savePlanned = async () => {
    const data = { name: THIRTEENTH_NAME, type: 'income' as const, amountLow: thirteenth.amount, amountHigh: thirteenth.amount, date: existing?.date ?? payDate, status: 'expected' as const }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, ...data, categoryId: existing.categoryId, notes: existing.notes })
      else await create.mutateAsync(data)
      toast.success(existing ? 'Planned 13th month updated' : 'Added to Planned for Dec 15')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save it to Planned')
    }
  }

  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <ManageHeader
            eyebrow="Philippine pay"
            title="Pay & taxes"
            statsHref=""
            showAmounts={showAmounts}
            onToggleAmounts={() => setShowAmounts((v) => !v)}
            summary={pay.mode === 'employee' ? (pay.monthlyBasic > 0 ? `${money(salary.net)} take-home a month` : undefined) : pay.freelanceGross > 0 ? `About ${money(Math.min(tax.graduated, tax.eightPercent ?? Infinity))} tax this year` : undefined}
          />

          <div role="radiogroup" aria-label="How you are paid" className="mt-4 flex gap-1 rounded-full bg-secondary p-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={pay.mode === m.value}
                onClick={() => pay.set({ mode: m.value })}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors',
                  pay.mode === m.value ? 'bg-card text-foreground shadow-ios' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {pay.mode === 'employee' ? (
            <div className="mt-4 space-y-4">
              <Section icon={Wallet} title="Salary" tone="bg-primary/10 text-primary">
                <NumberField label="Monthly basic salary" value={pay.monthlyBasic} onChange={(n) => pay.set({ monthlyBasic: n })} />
                {pay.monthlyBasic > 0 && (
                  <dl className="mt-3 divide-y divide-border">
                    <Line label="SSS" value={`-${money(salary.contributions.sss)}`} />
                    <Line label="PhilHealth" value={`-${money(salary.contributions.philhealth)}`} />
                    <Line label="Pag-IBIG" value={`-${money(salary.contributions.pagibig)}`} />
                    <Line label="Withholding tax" value={`-${money(salary.tax)}`} />
                    <Line label="Take-home a month" value={money(salary.net)} strong />
                  </dl>
                )}
              </Section>

              <Section icon={Gift} title="13th month" tone="bg-success/15 text-success">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Started this year in</span>
                    <select value={pay.startMonth} onChange={(e) => pay.set({ startMonth: Number(e.target.value) })} className={fieldClass}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i === 0 ? 'January or before' : format(new Date(2000, i, 1), 'MMMM')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberField label="Unpaid leave days" value={pay.unpaidLeaveDays} onChange={(n) => pay.set({ unpaidLeaveDays: n })} suffix="days" />
                </div>
                <div className="mt-3">
                  <NumberField label="Other bonuses this year" value={pay.otherBenefits} onChange={(n) => pay.set({ otherBenefits: n })} />
                </div>
                {pay.monthlyBasic > 0 ? (
                  <>
                    <dl className="mt-3 divide-y divide-border">
                      <Line label={`Basic pay earned (${monthsWorked} month${monthsWorked === 1 ? '' : 's'})`} value={money(thirteenth.earned)} />
                      {thirteenth.leaveCut > 0 && <Line label="Less unpaid leave" value={`-${money(thirteenth.leaveCut)}`} />}
                      <Line label="13th month, by Dec 24" value={money(thirteenth.amount)} strong />
                      {thirteenth.taxable > 0 && <Line label={`Taxed (above ${money(BENEFITS_EXEMPT)} with bonuses)`} value={money(thirteenth.taxable)} tone="text-warning" />}
                    </dl>
                    <button
                      type="button"
                      onClick={savePlanned}
                      disabled={create.isPending || update.isPending || thirteenth.amount <= 0}
                      className="mt-3 w-full rounded-full bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {existing ? 'Update it in Planned' : 'Add it to Planned'}
                    </button>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Enter your monthly basic salary above to see it.</p>
                )}
              </Section>

              <Section icon={Plane} title="Leave" tone="bg-accent/15 text-accent">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Leave credits this year" value={pay.leaveCredits} onChange={(n) => pay.set({ leaveCredits: n })} suffix="days" />
                  <NumberField label="Used so far" value={pay.leaveUsed} onChange={(n) => pay.set({ leaveUsed: n })} suffix="days" />
                </div>
                <dl className="mt-3 divide-y divide-border">
                  <Line label="Days left" value={`${leave.left}`} strong />
                  {pay.monthlyBasic > 0 && <Line label="Worth, if converted to cash" value={money(leave.worth)} />}
                </dl>
              </Section>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Section icon={Receipt} title="Income tax" tone="bg-warning/15 text-warning">
                <NumberField label={`Expected gross for ${today.getFullYear()}`} value={pay.freelanceGross} onChange={(n) => pay.set({ freelanceGross: n })} />
                {incomeSoFar > 0 && (
                  <button
                    type="button"
                    onClick={() => pay.set({ freelanceGross: Math.round((incomeSoFar / monthsSoFar) * 12) })}
                    className="mt-2 text-sm font-semibold text-primary"
                  >
                    Use my income in Fico ({money(incomeSoFar)} so far, about {money((incomeSoFar / monthsSoFar) * 12)} a year)
                  </button>
                )}
                {pay.freelanceGross > 0 && (
                  <dl className="mt-3 divide-y divide-border">
                    <Line
                      label="8% flat (on gross above ₱250,000)"
                      value={tax.eightPercent === null ? 'Not allowed over ₱3M' : money(tax.eightPercent)}
                      tone={tax.best === 'eight' ? 'text-success' : undefined}
                    />
                    <Line label="Graduated, 40% deduction + 3% percentage tax" value={money(tax.graduated)} tone={tax.best === 'graduated' ? 'text-success' : undefined} />
                    <Line label={`Set aside a month (${tax.best === 'eight' ? '8%' : 'graduated'})`} value={money((tax.best === 'eight' ? tax.eightPercent ?? 0 : tax.graduated) / 12)} strong />
                  </dl>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Choose 8% on your first quarterly return of the year. It replaces both income and percentage tax.</p>
              </Section>

              {pay.freelanceGross > 0 && (
                <Section icon={Wallet} title="Contributions a month" tone="bg-primary/10 text-primary">
                  <dl className="divide-y divide-border">
                    <Line label="SSS (self-employed, 15%)" value={money(monthlyContrib.sss)} />
                    <Line label="PhilHealth (5%)" value={money(monthlyContrib.philhealth)} />
                    <Line label="Pag-IBIG" value={money(monthlyContrib.pagibig)} />
                    <Line label="Total" value={money(monthlyContrib.total)} strong />
                  </dl>
                </Section>
              )}

              <Section icon={CalendarCheck} title="Next BIR deadline" tone="bg-accent/15 text-accent">
                <p className="font-heading text-lg font-semibold text-foreground">{format(deadline.date, 'EEEE, MMMM d')}</p>
                <p className="text-sm text-muted-foreground">{deadline.label}</p>
              </Section>
            </div>
          )}

          <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
            Estimates with 2025 rates (TRAIN tax table, SSS 15% up to a ₱35,000 credit, PhilHealth 5%, Pag-IBIG 2%). Your payslip or BIR forms are the final word. Saved on this device only.
          </p>
        </main>
      </IonContent>
    </IonPage>
  )
}
