'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Plus } from 'lucide-react'
import { FormSheet } from '@/components/ui/form-sheet'
import { useSetBudgetGroup } from '@/queries/user/budget-plan/budget-plans'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { MonthBudgetLine } from '@/utils/budget-plans'
import type { BudgetPlan, BudgetPlanGroup } from '@/types/budget-plan'

interface GroupBudgetsSheetProps {
  open: boolean
  onClose: () => void
  group: BudgetPlanGroup | null
  /** The month's budgets. */
  lines: MonthBudgetLine[]
  plans: BudgetPlan[]
  onCreateBudget: () => void
}

/** Pick which budgets belong to a spending group. A budget is in at most one group. */
export function GroupBudgetsSheet({ open, onClose, group, lines, plans, onCreateBudget }: GroupBudgetsSheetProps) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { mutateAsync: setGroup, isPending } = useSetBudgetGroup()
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const groupNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of plans) for (const g of p.groups) map.set(g.id, `${p.name} · ${g.name}`)
    return map
  }, [plans])

  useEffect(() => {
    if (open && group) setPicked(new Set(lines.filter((l) => l.groupId === group.id).map((l) => l.id)))
  }, [open, group, lines])

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    if (!group) return
    const add = lines.filter((l) => picked.has(l.id) && l.groupId !== group.id).flatMap((l) => l.rowIds)
    const remove = lines.filter((l) => !picked.has(l.id) && l.groupId === group.id).flatMap((l) => l.rowIds)
    try {
      if (add.length) await setGroup({ budgetIds: add, groupId: group.id })
      if (remove.length) await setGroup({ budgetIds: remove, groupId: null })
      toast.success('Group updated')
      onClose()
    } catch {
      // handleApiError already told the user.
    }
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={group ? `Budgets in ${group.name}` : 'Budgets'}
      description="Pick the budgets whose spending counts toward this group."
      submitLabel="Save"
      onSubmit={submit}
      busy={isPending}
    >
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no budgets this month yet.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => {
            const selected = picked.has(l.id)
            const elsewhere = l.groupId && l.groupId !== group?.id ? groupNames.get(l.groupId) : null
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(l.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatMoney(l.limit, currency, hideAmountsOnOpen)} a month{elsewhere ? ` · now in ${elsewhere}` : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onCreateBudget}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        New budget in this group
      </button>
    </FormSheet>
  )
}
