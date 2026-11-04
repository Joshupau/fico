// Budget plans (a 50/30/20 split, say) and the groups in them. Plain table reads and writes (no
// RPC), so they also work offline. Totals are worked out on the device in utils/budget-plans.ts.
// Supabase only: there is no legacy API route for them.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BudgetPlan, BudgetPlanGroup, SavePlanData } from "@/types/budget-plan";
import type { MonthTxn } from "@/utils/budget-plans";

const assertSupabase = () => {
  if (process.env.NEXT_PUBLIC_BACKEND !== 'supabase') {
    throw new Error('Budget plans need the Supabase backend.');
  }
};

const num = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const useListPlans = () =>
  useQuery({
    queryKey: ["budget-plans"],
    queryFn: async (): Promise<BudgetPlan[]> => {
      assertSupabase();
      const [plans, groups] = await Promise.all([
        supabase.from('budget_plans').select('*').eq('status', 'active').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('budget_plan_groups').select('*').order('sort_order', { ascending: true }),
      ]);
      if (plans.error) throw plans.error;
      if (groups.error) throw groups.error;
      const allGroups = toCamelCase<BudgetPlanGroup[]>(groups.data ?? []).map((g) => ({
        ...g,
        percent: num(g.percent),
        amount: num(g.amount),
        walletIds: g.walletIds ?? [],
        sortOrder: Number(g.sortOrder) || 0,
      }));
      return toCamelCase<BudgetPlan[]>(plans.data ?? []).map((p) => ({
        ...p,
        income: num(p.income),
        sortOrder: Number(p.sortOrder) || 0,
        groups: allGroups.filter((g) => g.planId === p.id),
      }));
    },
  });

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["budget-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    ]);
};

/** Creates or updates a plan with its groups. Groups left out of `groups` are deleted (their budgets stay, ungrouped). */
export const useSavePlan = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: SavePlanData & { existingGroupIds?: string[]; sortOrder?: number }) => {
      assertSupabase();
      const planId = data.id ?? newId();
      const planRow = { name: data.name, income: data.income, color: data.color };
      if (data.id) {
        const { error } = await supabase.from('budget_plans').update(planRow).eq('id', planId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('budget_plans').insert({ id: planId, ...planRow, sort_order: data.sortOrder ?? 0 });
        if (error) throw error;
      }
      const kept = new Set<string>();
      for (const [index, g] of data.groups.entries()) {
        const row = {
          name: g.name,
          kind: g.kind,
          percent: g.percent,
          amount: g.percent === null ? g.amount : null,
          color: g.color,
          icon: g.icon,
          wallet_ids: g.walletIds,
          sort_order: index,
        };
        if (g.id) {
          kept.add(g.id);
          const { error } = await supabase.from('budget_plan_groups').update(row).eq('id', g.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('budget_plan_groups').insert({ id: newId(), plan_id: planId, ...row });
          if (error) throw error;
        }
      }
      for (const id of data.existingGroupIds ?? []) {
        if (kept.has(id)) continue;
        const { error } = await supabase.from('budget_plan_groups').delete().eq('id', id);
        if (error) throw error;
      }
      return planId;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

/** Deletes a plan and its groups. Its budgets stay, as everyday budgets. */
export const useDeletePlan = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertSupabase();
      const { error } = await supabase.from('budget_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

/** Puts budgets into a group, or takes them out (groupId null). */
export const useSetBudgetGroup = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ budgetIds, groupId }: { budgetIds: string[]; groupId: string | null }) => {
      assertSupabase();
      for (const id of budgetIds) {
        const { error } = await supabase.from('budgets').update({ group_id: groupId }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

const PAGE = 1000;

/** The month's completed transactions, with just what income and savings need. */
export const useMonthTransactions = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return useQuery({
    queryKey: ["transactions", "month-money", start.toISOString()],
    queryFn: async (): Promise<MonthTxn[]> => {
      assertSupabase();
      const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id,type,amount,wallet_id,to_wallet_id,obligation_id')
          .eq('status', 'completed')
          .gte('date', start.toISOString())
          .lt('date', end.toISOString())
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return rows.map((r) => ({
        type: r.type,
        amount: Number(r.amount) || 0,
        walletId: String(r.wallet_id),
        toWalletId: r.to_wallet_id ? String(r.to_wallet_id) : null,
        obligationId: r.obligation_id ?? null,
      }));
    },
  });
};
