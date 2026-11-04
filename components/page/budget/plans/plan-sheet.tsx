'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { chipClass, Field, FormSheet, fieldClass, labelClass, MoneyField, scrollRowClass } from '@/components/ui/form-sheet'
import { useSavePlan } from '@/queries/user/budget-plan/budget-plans'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { groupTarget, PLAN_TEMPLATES } from '@/utils/budget-plans'
import { GROUP_COLORS, GROUP_ICONS } from './group-icon'
import type { BudgetPlan, PlanGroupKind } from '@/types/budget-plan'

type DraftGroup = {
  key: string
  id?: string
  name: string
  kind: PlanGroupKind
  mode: 'percent' | 'amount'
  value: string
  icon: string | null
  color: string | null
  walletIds: string[]
}

let draftSeq = 0
const draftKey = () => `g${++draftSeq}`

interface PlanSheetProps {
  open: boolean
  onClose: () => void
  /** When set, edits this plan instead of creating one. */
  plan?: BudgetPlan | null
  /** The income Fico sees for the month, used when the plan has none of its own. */
  monthIncome: number
  /** Wallets a savings group can count (not credit cards). */
  wallets: { id: string; name: string; type: string }[]
  nextSortOrder?: number
  onSaved?: (planId: string) => void
}

export function PlanSheet({ open, onClose, plan, monthIncome, wallets, nextSortOrder = 0, onSaved }: PlanSheetProps) {
  const { currency } = useSettingsStore()
  const { mutate: save, isPending } = useSavePlan()
  const isEdit = !!plan

  const [template, setTemplate] = useState('50-30-20')
  const [name, setName] = useState('')
  const [income, setIncome] = useState('')
  const [groups, setGroups] = useState<DraftGroup[]>([])

  const fromTemplate = (key: string): DraftGroup[] =>
    (PLAN_TEMPLATES.find((t) => t.key === key)?.groups ?? []).map((g) => ({
      key: draftKey(),
      name: g.name,
      kind: g.kind,
      mode: 'percent',
      value: String(g.percent),
      icon: g.icon,
      color: g.color,
      walletIds: [],
    }))

  useEffect(() => {
    if (!open) return
    if (plan) {
      setName(plan.name)
      setIncome(plan.income === null ? '' : String(plan.income))
      setGroups(
        [...plan.groups]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => ({
            key: draftKey(),
            id: g.id,
            name: g.name,
            kind: g.kind,
            mode: g.percent !== null ? 'percent' : 'amount',
            value: String(g.percent ?? g.amount ?? ''),
            icon: g.icon,
            color: g.color,
            walletIds: g.walletIds,
          }))
      )
    } else {
      setTemplate('50-30-20')
      setName('50/30/20')
      setIncome('')
      setGroups(fromTemplate('50-30-20'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan])

  const pickTemplate = (key: string) => {
    setTemplate(key)
    const t = PLAN_TEMPLATES.find((x) => x.key === key)
    if (t && (!name.trim() || PLAN_TEMPLATES.some((x) => x.label === name))) setName(key === 'custom' ? '' : t.label)
    setGroups(fromTemplate(key))
  }

  const patch = (key: string, change: Partial<DraftGroup>) => setGroups((list) => list.map((g) => (g.key === key ? { ...g, ...change } : g)))
  const addGroup = () =>
    setGroups((list) => [
      ...list,
      { key: draftKey(), name: '', kind: 'spend', mode: 'percent', value: '', icon: null, color: GROUP_COLORS[list.length % GROUP_COLORS.length], walletIds: [] },
    ])

  const planIncome = income.trim() === '' ? null : Number(income) || 0
  const effectiveIncome = planIncome ?? monthIncome
  const allocated = groups.reduce(
    (s, g) => s + groupTarget({ percent: g.mode === 'percent' ? Number(g.value) || 0 : null, amount: g.mode === 'amount' ? Number(g.value) || 0 : null }, effectiveIncome),
    0
  )
  const percentTotal = groups.filter((g) => g.mode === 'percent').reduce((s, g) => s + (Number(g.value) || 0), 0)
  const money = (v: number) => formatMoney(v, currency, false)

  const submit = () => {
    if (!name.trim()) return void toast.error('Give the plan a name')
    if (groups.some((g) => !g.name.trim())) return void toast.error('Every group needs a name')
    if (groups.some((g) => g.mode === 'percent' && (Number(g.value) || 0) > 100)) return void toast.error('A group can be at most 100%')
    save(
      {
        id: plan?.id,
        name: name.trim(),
        income: planIncome,
        color: plan?.color ?? null,
        sortOrder: nextSortOrder,
        existingGroupIds: plan?.groups.map((g) => g.id) ?? [],
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name.trim(),
          kind: g.kind,
          percent: g.mode === 'percent' ? Number(g.value) || 0 : null,
          amount: g.mode === 'amount' ? Number(g.value) || 0 : null,
          icon: g.icon,
          color: g.color,
          walletIds: g.kind === 'save' ? g.walletIds : [],
        })),
      },
      {
        onSuccess: (planId) => {
          toast.success(isEdit ? 'Plan saved' : 'Plan created')
          onSaved?.(planId)
          onClose()
        },
      }
    )
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit plan' : 'New plan'}
      description="Split your income into groups such as needs, wants and savings, and put budgets in them."
      submitLabel={isEdit ? 'Save plan' : 'Create plan'}
      onSubmit={submit}
      busy={isPending}
    >
      {!isEdit && (
        <Field label="Start from" hint={PLAN_TEMPLATES.find((t) => t.key === template)?.description}>
          <div className={scrollRowClass} role="group" aria-label="Template">
            {PLAN_TEMPLATES.map((t) => (
              <button key={t.key} type="button" aria-pressed={template === t.key} onClick={() => pickTemplate(t.key)} className={chipClass(template === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Plan name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="50/30/20" aria-label="Plan name" className={fieldClass} />
      </Field>

      <Field
        label="Monthly income (optional)"
        hint={planIncome === null ? `Empty uses the income Fico sees each month (${money(monthIncome)} this month).` : 'The plan splits this amount every month.'}
      >
        <MoneyField value={income} onChange={setIncome} ariaLabel="Monthly income" placeholder={monthIncome > 0 ? String(Math.round(monthIncome)) : '0.00'} />
      </Field>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between">
          <p className={labelClass}>Groups</p>
          <p className={`text-xs font-semibold ${percentTotal > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {money(allocated)} of {money(effectiveIncome)}
          </p>
        </div>
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key} className="space-y-3 rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <input value={g.name} onChange={(e) => patch(g.key, { name: e.target.value })} placeholder="Needs" aria-label="Group name" className={fieldClass} />
                <button
                  type="button"
                  onClick={() => setGroups((list) => list.filter((x) => x.key !== g.key))}
                  aria-label={`Remove ${g.name || 'group'}`}
                  className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
                {(['spend', 'save'] as const).map((kind) => (
                  <button key={kind} type="button" aria-pressed={g.kind === kind} onClick={() => patch(g.key, { kind })} className={chipClass(g.kind === kind)}>
                    {kind === 'spend' ? 'Spending' : 'Savings'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex shrink-0 rounded-full bg-secondary p-1" role="group" aria-label="Target type">
                  {(['percent', 'amount'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={g.mode === mode}
                      onClick={() => patch(g.key, { mode, value: '' })}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${g.mode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                    >
                      {mode === 'percent' ? '%' : 'Amount'}
                    </button>
                  ))}
                </div>
                <input
                  value={g.value}
                  onChange={(e) => patch(g.key, { value: e.target.value.replace(/[^0-9.]/g, '') })}
                  inputMode="decimal"
                  placeholder={g.mode === 'percent' ? '50' : '10000'}
                  aria-label={g.mode === 'percent' ? 'Percent of income' : 'Target amount'}
                  className={fieldClass}
                />
                {g.mode === 'percent' && (
                  <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {money(groupTarget({ percent: Number(g.value) || 0, amount: null }, effectiveIncome))}
                  </span>
                )}
              </div>

              <div className={scrollRowClass} role="group" aria-label="Icon">
                {GROUP_ICONS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={g.icon === key}
                    onClick={() => patch(g.key, { icon: key })}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${g.icon === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={g.color === color}
                    onClick={() => patch(g.key, { color })}
                    className={`h-7 w-7 rounded-full border-2 ${g.color === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {g.kind === 'save' && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Counts money moved into {g.walletIds.length ? 'these wallets' : 'all your savings wallets'} this month.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {wallets.map((w) => {
                      const selected = g.walletIds.includes(w.id)
                      return (
                        <button
                          key={w.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => patch(g.key, { walletIds: selected ? g.walletIds.filter((id) => id !== w.id) : [...g.walletIds, w.id] })}
                          className={chipClass(selected)}
                        >
                          {w.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addGroup}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Add group
        </button>
        {percentTotal > 100 && <p className="mt-2 text-xs font-medium text-destructive">The groups add up to {percentTotal.toFixed(0)}% of your income.</p>}
      </div>
    </FormSheet>
  )
}
