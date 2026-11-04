export type PlanGroupKind = 'spend' | 'save';

export type BudgetPlanGroup = {
  id: string;
  planId: string;
  name: string;
  kind: PlanGroupKind;
  /** Target as a percent of the plan's income. When null, `amount` is the target. */
  percent: number | null;
  amount: number | null;
  color: string | null;
  icon: string | null;
  /** Savings groups: wallets that count. Empty means every savings wallet. */
  walletIds: string[];
  sortOrder: number;
};

export type BudgetPlan = {
  id: string;
  name: string;
  /** Monthly income the plan splits. Null uses the income Fico sees for the month. */
  income: number | null;
  color: string | null;
  status: 'active' | 'archived';
  sortOrder: number;
  createdAt: string;
  groups: BudgetPlanGroup[];
};

export type SavePlanGroupData = {
  /** Set for a group that already exists. */
  id?: string;
  name: string;
  kind: PlanGroupKind;
  percent: number | null;
  amount: number | null;
  color: string | null;
  icon: string | null;
  walletIds: string[];
};

export type SavePlanData = {
  id?: string;
  name: string;
  income: number | null;
  color: string | null;
  groups: SavePlanGroupData[];
};
