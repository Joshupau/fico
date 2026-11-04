'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FolderKanban, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
import BudgetList from '@/components/budgets/budget-list'
import BudgetModal from '@/components/budgets/budget-modal'
import { useDeletePlan } from '@/queries/user/budget-plan/budget-plans'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import type { useBudgetMonth } from '@/hooks/use-budget-month'
import type { GroupStatus, PlanStatus } from '@/utils/budget-plans'
import type { BudgetPlan, BudgetPlanGroup } from '@/types/budget-plan'
import { GroupBadge } from './group-icon'
import { PlanSheet } from './plan-sheet'
import { GroupBudgetsSheet } from './group-budgets-sheet'
import { UnplannedBudgets } from './unplanned-budgets'

type BudgetMonth = ReturnType<typeof useBudgetMonth>

const tintOf = (g: BudgetPlanGroup) => g.color || (g.kind === 'save' ? '#34C759' : '#0A84FF')

function Bar({ pct, color, over, className = 'h-2.5' }: { pct: number; color: string; over?: boolean; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-destructive' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, ...(over ? {} : { backgroundColor: color }) }}
      />
    </div>
  )
}

/**
 * Plans on the Budgets page. Each plan splits an income into groups, and each spending group holds
 * its budgets (the same budget cards as the rest of the page). Every budget lives in a plan: budgets
 * that aren't in one (made before plans) are listed so they can be moved in or removed.
 */
export function PlansSection({ data, month, newPlanRequest = 0 }: { data: BudgetMonth; month: Date; newPlanRequest?: number }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (v: number) => formatMoney(v, currency, hideAmountsOnOpen)
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long' })

  const [sheet, setSheet] = useState<{ open: boolean; plan: BudgetPlan | null }>({ open: false, plan: null })
  const [groupSheet, setGroupSheet] = useState<BudgetPlanGroup | null>(null)
  const [newBudgetGroup, setNewBudgetGroup] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BudgetPlan | null>(null)
  const { mutate: deletePlan, isPending: removing } = useDeletePlan()

  // The page's "New plan" button.
  useEffect(() => {
    if (newPlanRequest > 0) setSheet({ open: true, plan: null })
  }, [newPlanRequest])

  // Before the plans update reaches the account, the page is just budgets, as it was.
  if (data.plansUnavailable) return null

  const { planStatuses, lines, plans, summary, everydayLines } = data

  const confirmDelete = () => {
    if (!deleting) return
    deletePlan(
      { id: deleting.id },
      {
        onSuccess: () => {
          toast.success('Plan deleted')
          setDeleting(null)
        },
      }
    )
  }

  return (
    <section className="mb-8 space-y-6">
      {!data.plansLoading && !data.loading && (
        <UnplannedBudgets lines={everydayLines} plans={plans} onNewPlan={() => setSheet({ open: true, plan: null })} />
      )}

      {data.plansLoading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
      ) : planStatuses.length === 0 ? (
        <button
          type="button"
          onClick={() => setSheet({ open: true, plan: null })}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <FolderKanban className="h-6 w-6" />
          <span className="font-bold">Start with a plan</span>
          <span className="max-w-sm text-xs">
            Your budgets live inside a plan. Try 50/30/20: half of your income on needs, 30% on wants and 20% saved. Saving the plan makes its budgets.
          </span>
        </button>
      ) : (
        planStatuses.map((status) => (
          <PlanBlock
            key={status.plan.id}
            status={status}
            month={month}
            money={money}
            monthLabel={monthLabel}
            onEdit={() => setSheet({ open: true, plan: status.plan })}
            onDelete={() => setDeleting(status.plan)}
            onAddBudget={(group) => setNewBudgetGroup(group.id)}
            onPickBudgets={setGroupSheet}
          />
        ))
      )}

      <PlanSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        plan={sheet.plan}
        monthIncome={summary.income}
        wallets={data.savingsWallets}
        nextSortOrder={plans.length}
        lines={lines}
      />
      <GroupBudgetsSheet
        open={!!groupSheet}
        onClose={() => setGroupSheet(null)}
        group={groupSheet}
        lines={lines}
        plans={plans}
        onCreateBudget={() => {
          setNewBudgetGroup(groupSheet?.id ?? null)
          setGroupSheet(null)
        }}
      />
      <BudgetModal open={!!newBudgetGroup} onClose={() => setNewBudgetGroup(null)} defaultGroupId={newBudgetGroup} />
      <ConfirmSheet
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(null)}
        onConfirm={confirmDelete}
        variant="destructive"
        title="Delete this plan?"
        description={deleting ? `${deleting.name}, its groups and their budgets will be deleted. Your transactions and past months stay as they are.` : undefined}
        confirmLabel="Delete"
        confirmingLabel="Deleting..."
        isConfirming={removing}
      />
    </section>
  )
}

function PlanBlock({
  status,
  month,
  money,
  monthLabel,
  onEdit,
  onDelete,
  onAddBudget,
  onPickBudgets,
}: {
  status: PlanStatus
  month: Date
  money: (v: number) => string
  monthLabel: string
  onEdit: () => void
  onDelete: () => void
  onAddBudget: (group: BudgetPlanGroup) => void
  onPickBudgets: (group: BudgetPlanGroup) => void
}) {
  const { plan, income, usesMonthIncome, groups, spent, spendTarget, saved, saveTarget, canSave, allocatedPct } = status
  const unallocated = Math.max(0, 100 - allocatedPct)

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-ios md:p-6">
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold leading-none text-foreground">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Splits {money(income)} · {usesMonthIncome ? `your income for ${monthLabel}` : 'set on this plan'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${plan.name}`} className="h-9 w-9 rounded-full">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${plan.name}`} className="h-9 w-9 rounded-full text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary" aria-label="How the income is split">
              {groups.map((g) => (
                <div key={g.group.id} style={{ width: `${income > 0 ? Math.min(100, (g.target / income) * 100) : 0}%`, backgroundColor: tintOf(g.group) }} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {groups.map((g) => `${g.group.name} ${money(g.target)}`).join(' · ')}
              {unallocated > 0.5 && income > 0 ? ` · ${unallocated.toFixed(0)}% not in a group` : ''}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Spent <span className="font-semibold tabular-nums text-foreground">{money(spent)}</span> of {money(spendTarget)} ·{' '}
            {saveTarget > 0 ? (
              <>
                saved <span className="font-semibold tabular-nums text-foreground">{money(saved)}</span> of {money(saveTarget)}
              </>
            ) : (
              <>
                can save <span className={`font-semibold tabular-nums ${canSave < 0 ? 'text-destructive' : 'text-success'}`}>{money(canSave)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">This plan has no groups yet.</p>
          <Button onClick={onEdit} className="mt-3 rounded-full">
            Add groups
          </Button>
        </div>
      ) : (
        groups.map((g) => (
          <GroupBlock key={g.group.id} status={g} month={month} money={money} onAdd={() => onAddBudget(g.group)} onPick={() => onPickBudgets(g.group)} />
        ))
      )}
    </div>
  )
}

function GroupBlock({
  status,
  month,
  money,
  onAdd,
  onPick,
}: {
  status: GroupStatus
  month: Date
  money: (v: number) => string
  onAdd: () => void
  onPick: () => void
}) {
  const { group, target, budgeted, lines, progress, pct } = status
  const isSave = group.kind === 'save'
  const over = !isSave && target > 0 && progress > target
  const tint = tintOf(group)

  return (
    <div className="space-y-3 border-l-2 pl-3 md:pl-4" style={{ borderColor: tint }}>
      <div className="flex items-center gap-3">
        <GroupBadge icon={group.icon} kind={group.kind} color={group.color} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight text-foreground">{group.name}</p>
              <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {isSave ? 'Savings' : 'Spending'}
                {group.percent !== null ? ` · ${Number(group.percent).toFixed(0)}%` : ''}
              </p>
            </div>
            <p className={`shrink-0 text-sm font-semibold tabular-nums ${over ? 'text-destructive' : 'text-foreground'}`}>
              {money(progress)} <span className="font-medium text-muted-foreground">/ {money(target)}</span>
            </p>
          </div>
          <Bar pct={pct} color={tint} over={over} className="mt-1.5 h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {isSave
              ? `${progress >= target && target > 0 ? 'Reached' : `${money(Math.max(0, target - progress))} to go`} · ${group.walletIds.length ? 'money moved into the wallets you picked' : 'money moved into your savings wallets'}`
              : over
                ? `${money(progress - target)} over`
                : `${money(target - progress)} left`}
            {!isSave && budgeted > target && target > 0 ? ` · budgets add up to ${money(budgeted)}, more than this group` : ''}
          </p>
        </div>
        {!isSave && lines.length > 0 && (
          <Button variant="ghost" size="icon" onClick={onPick} aria-label={`Choose budgets for ${group.name}`} className="h-9 w-9 shrink-0 rounded-full">
            <ListChecks className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!isSave && (
        <>
          <BudgetList month={month} groupId={group.id} bare onAdd={onAdd} />
          {lines.length === 0 && (
            <button type="button" onClick={onPick} className="text-xs font-semibold text-primary hover:underline">
              Or move budgets you already have into {group.name}
            </button>
          )}
        </>
      )}
    </div>
  )
}
