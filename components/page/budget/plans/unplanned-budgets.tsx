'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import { useSetBudgetGroup } from '@/queries/user/budget-plan/budget-plans'
import { useUpdateBudget } from '@/queries/user/budget/budgets'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { MonthBudgetLine } from '@/utils/budget-plans'
import type { BudgetPlan } from '@/types/budget-plan'

/**
 * Budgets live inside plans. Budgets made before plans existed (or left behind some other way) show
 * here until they are moved into a spending group or removed.
 */
export function UnplannedBudgets({ lines, plans, onNewPlan }: { lines: MonthBudgetLine[]; plans: BudgetPlan[]; onNewPlan: () => void }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const { mutateAsync: setGroup, isPending: moving } = useSetBudgetGroup()
  const { mutateAsync: updateBudget, isPending: removing } = useUpdateBudget()
  const [removingLine, setRemovingLine] = useState<MonthBudgetLine | null>(null)
  const groups = plans.flatMap((p) => p.groups.filter((g) => g.kind === 'spend').map((g) => ({ id: g.id, label: `${p.name} · ${g.name}` })))

  if (lines.length === 0) return null

  const move = async (line: MonthBudgetLine, groupId: string) => {
    if (!groupId) return
    try {
      await setGroup({ budgetIds: line.rowIds, groupId })
      toast.success(`${line.name} moved into your plan`)
    } catch {
      // handleApiError already told the user.
    }
  }

  const confirmRemove = async () => {
    if (!removingLine) return
    try {
      for (const id of removingLine.rowIds) await updateBudget({ id, status: 'archived' })
      toast.success('Budget removed')
      setRemovingLine(null)
    } catch {
      // handleApiError already told the user.
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning/5 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground">
            {lines.length === 1 ? '1 budget isn’t in a plan' : `${lines.length} budgets aren’t in a plan`}
          </p>
          <p className="text-xs text-muted-foreground">
            {groups.length
              ? 'Budgets live inside plans now. Move each one into a spending group, or remove it.'
              : 'Budgets live inside plans now. Make a plan first, then move these into it.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{line.name}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(line.limit, currency, hideAmountsOnOpen)} a month</p>
            </div>
            <div className="flex items-center gap-2">
              {groups.length > 0 && (
                <select
                  aria-label={`Move ${line.name} into a plan group`}
                  value=""
                  disabled={moving}
                  onChange={(e) => move(line, e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-secondary/40 px-3 text-sm font-semibold text-foreground sm:w-56 sm:flex-none"
                >
                  <option value="" disabled>
                    Move into…
                  </option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRemovingLine(line)}
                aria-label={`Remove ${line.name}`}
                className="h-9 w-9 shrink-0 rounded-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <Button onClick={onNewPlan} className="w-full rounded-full sm:w-auto">
          Make a plan
        </Button>
      )}

      <ConfirmSheet
        open={!!removingLine}
        onOpenChange={(next) => !next && setRemovingLine(null)}
        onConfirm={confirmRemove}
        variant="destructive"
        title="Remove this budget?"
        description={removingLine ? `${removingLine.name} stops renewing and leaves your budgets. Your transactions stay as they are.` : undefined}
        confirmLabel="Remove"
        confirmingLabel="Removing..."
        isConfirming={removing}
      />
    </div>
  )
}
