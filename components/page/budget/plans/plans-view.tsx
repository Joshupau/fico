'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, FolderKanban, Pencil, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmSheet } from '@/components/ui/confirm-sheet'
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

type BudgetMonth = ReturnType<typeof useBudgetMonth>

const tintOf = (g: BudgetPlanGroup) => g.color || (g.kind === 'save' ? '#34C759' : '#0A84FF')

export function PlansView({ data, month }: { data: BudgetMonth; month: Date }) {
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  const money = (v: number) => formatMoney(v, currency, hideAmountsOnOpen)
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long' })

  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ open: boolean; plan: BudgetPlan | null }>({ open: false, plan: null })
  const [groupSheet, setGroupSheet] = useState<BudgetPlanGroup | null>(null)
  const [newBudgetGroup, setNewBudgetGroup] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BudgetPlan | null>(null)
  const { mutate: deletePlan, isPending: removing } = useDeletePlan()

  const { planStatuses, lines, everydayLines, plans, summary } = data
  const current = planStatuses.find((p) => p.plan.id === openPlanId) ?? null
  const totals = useMemo(() => {
    const spent = lines.reduce((s, l) => s + l.spent, 0)
    const everyday = everydayLines.reduce((s, l) => s + l.spent, 0)
    return { spent, everyday, plans: spent - everyday }
  }, [lines, everydayLines])

  const confirmDelete = () => {
    if (!deleting) return
    deletePlan(
      { id: deleting.id },
      {
        onSuccess: () => {
          toast.success('Plan deleted. Its budgets are now everyday budgets.')
          setDeleting(null)
          setOpenPlanId(null)
        },
      }
    )
  }

  if (data.plansUnavailable) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-ios">
        <p className="font-bold text-foreground">Plans aren&apos;t ready yet</p>
        <p className="mt-1 text-sm text-muted-foreground">The plans update hasn&apos;t reached your account. Try again in a little while.</p>
      </div>
    )
  }

  const sheets = (
    <>
      <PlanSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        plan={sheet.plan}
        monthIncome={summary.income}
        wallets={data.savingsWallets}
        nextSortOrder={plans.length}
        onSaved={(id) => !sheet.plan && setOpenPlanId(id)}
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
        description={deleting ? `${deleting.name} and its groups will be deleted. The budgets in it stay, as everyday budgets.` : undefined}
        confirmLabel="Delete"
        confirmingLabel="Deleting..."
        isConfirming={removing}
      />
    </>
  )

  if (current) {
    return (
      <div className="space-y-6">
        <PlanDetail
          status={current}
          money={money}
          monthLabel={monthLabel}
          onBack={() => setOpenPlanId(null)}
          onEdit={() => setSheet({ open: true, plan: current.plan })}
          onDelete={() => setDeleting(current.plan)}
          onManageGroup={setGroupSheet}
        />
        {sheets}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-ios md:p-8">
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative z-10">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderKanban className="h-4 w-4 text-primary" />
            All plans · {monthLabel}
          </h3>
          {data.loading ? <Skeleton className="mt-3 h-10 w-48" /> : <p className="mt-2 text-4xl font-black text-foreground">{money(totals.spent)}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            Spent · everyday budgets {money(totals.everyday)} · plans {money(totals.plans)}
          </p>
        </div>
      </div>

      {data.plansLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {planStatuses.map((p) => (
            <PlanCard key={p.plan.id} status={p} money={money} onOpen={() => setOpenPlanId(p.plan.id)} />
          ))}
          <button
            type="button"
            onClick={() => setSheet({ open: true, plan: null })}
            className="flex min-h-32 md:min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-6 w-6" />
            <span className="font-bold">New plan</span>
            {planStatuses.length === 0 && <span className="max-w-xs text-center text-xs">Try 50/30/20: half on needs, 30% on wants and 20% saved.</span>}
          </button>
        </div>
      )}
      {sheets}
    </div>
  )
}

function Bar({ pct, color, over }: { pct: number; color: string; over?: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-destructive' : ''}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%`, ...(over ? {} : { backgroundColor: color }) }} />
    </div>
  )
}

function PlanCard({ status, money, onOpen }: { status: PlanStatus; money: (v: number) => string; onOpen: () => void }) {
  const { plan, spent, spendTarget, canSave, groups } = status
  const pct = spendTarget > 0 ? (spent / spendTarget) * 100 : 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl border border-border bg-card p-5 text-left shadow-ios transition-all duration-300 hover:border-primary/50 hover:shadow-ios-lg"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderKanban className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-none text-foreground">{plan.name}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {groups.length} group{groups.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground/80">SPENT</p>
      <p className="text-2xl font-black text-foreground">
        {money(spent)} <span className="text-sm font-medium text-muted-foreground">/ {money(spendTarget)}</span>
      </p>
      <div className="mt-3">
        <Bar pct={pct} color="var(--primary)" over={spent > spendTarget && spendTarget > 0} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <span key={g.group.id} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${tintOf(g.group)}1F`, color: tintOf(g.group) }}>
            {g.group.name} {g.group.percent !== null ? `${Number(g.group.percent).toFixed(0)}%` : ''}
          </span>
        ))}
      </div>
      <p className={`mt-3 text-sm font-semibold ${canSave < 0 ? 'text-destructive' : 'text-success'}`}>
        {canSave < 0 ? `${money(Math.abs(canSave))} over your income` : `Can save ${money(canSave)}`}
      </p>
    </button>
  )
}

function PlanDetail({
  status,
  money,
  monthLabel,
  onBack,
  onEdit,
  onDelete,
  onManageGroup,
}: {
  status: PlanStatus
  money: (v: number) => string
  monthLabel: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onManageGroup: (group: BudgetPlanGroup) => void
}) {
  const { plan, income, usesMonthIncome, groups, spent, spendTarget, saved, saveTarget, canSave, allocatedPct } = status
  const unallocated = Math.max(0, 100 - allocatedPct)

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="All plans" className="h-10 w-10 shrink-0 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="truncate text-2xl font-bold text-foreground">{plan.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit plan" className="h-10 w-10 rounded-full">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete plan" className="h-10 w-10 rounded-full text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-ios md:p-8">
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Income to split</h3>
            <p className="text-4xl font-black text-foreground">{money(income)}</p>
            <p className="text-sm text-muted-foreground">{usesMonthIncome ? `Your income for ${monthLabel}` : 'Set on this plan, every month'}</p>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 bg-secondary/40 p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase text-muted-foreground">Spent</span>
              </div>
              <p className="break-words text-lg font-bold text-foreground">{money(spent)}</p>
              <p className="text-xs text-muted-foreground">of {money(spendTarget)}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/40 p-4">
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <PiggyBank className="h-4 w-4 text-success" />
                </div>
                <span className="text-xs font-semibold uppercase text-muted-foreground">Can save</span>
              </div>
              <p className={`break-words text-lg font-bold ${canSave < 0 ? 'text-destructive' : 'text-success'}`}>{money(canSave)}</p>
              <p className="text-xs text-muted-foreground">{saveTarget > 0 ? `saved ${money(saved)} of ${money(saveTarget)}` : 'after spending groups'}</p>
            </div>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="font-bold text-foreground">No groups yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Edit the plan to add groups such as Needs, Wants and Savings.</p>
          <Button onClick={onEdit} className="mt-4 rounded-full">
            Add groups
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.group.id} status={g} money={money} onManage={() => onManageGroup(g.group)} />
          ))}
        </div>
      )}
    </>
  )
}

function GroupCard({ status, money, onManage }: { status: GroupStatus; money: (v: number) => string; onManage: () => void }) {
  const { group, target, lines, budgeted, progress, pct } = status
  const isSave = group.kind === 'save'
  const over = !isSave && target > 0 && progress > target
  const tint = tintOf(group)
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-ios">
      <div className="mb-4 flex items-center gap-3">
        <GroupBadge icon={group.icon} kind={group.kind} color={group.color} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-none text-foreground">{group.name}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {isSave ? 'Savings' : 'Spending'}
            {group.percent !== null ? ` · ${Number(group.percent).toFixed(0)}%` : ''}
          </p>
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground/80">{isSave ? 'SAVED THIS MONTH' : 'SPENT'}</p>
      <p className={`text-2xl font-black ${over ? 'text-destructive' : 'text-foreground'}`}>
        {money(progress)} <span className="text-sm font-medium text-muted-foreground">/ {money(target)}</span>
      </p>
      <div className="mt-3 space-y-1.5">
        <Bar pct={pct} color={tint} over={over} />
        <div className="flex justify-between text-[11px] font-bold uppercase text-muted-foreground">
          <span>{pct.toFixed(0)}%</span>
          <span>{isSave ? (progress >= target && target > 0 ? 'Reached' : `${money(Math.max(0, target - progress))} to go`) : over ? `${money(progress - target)} over` : `${money(target - progress)} left`}</span>
        </div>
      </div>

      {isSave ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {group.walletIds.length ? 'Counts money moved into the wallets you picked.' : 'Counts money moved into your savings wallets.'}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">No budgets in this group yet.</p>
          ) : (
            <>
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{l.name}</span>
                  <span className={`shrink-0 tabular-nums ${l.spent > l.limit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {money(l.spent)} / {money(l.limit)}
                  </span>
                </div>
              ))}
              {budgeted > target && target > 0 && (
                <p className="text-xs font-medium text-warning">These budgets add up to {money(budgeted)}, more than the group&apos;s {money(target)}.</p>
              )}
            </>
          )}
          <Button variant="outline" onClick={onManage} className="mt-2 h-9 w-full rounded-xl border-border/50 text-sm">
            {lines.length ? 'Change budgets' : 'Add budgets'}
          </Button>
        </div>
      )}
    </div>
  )
}
