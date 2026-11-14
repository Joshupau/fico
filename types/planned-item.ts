export type PlannedItemType = 'income' | 'expense';
/** `done` means it already happened: the expense is paid (say, a ticket bought early) or the money came in. */
export type PlannedItemStatus = 'expected' | 'confirmed' | 'done';

/** Still to happen, so it counts in totals, forecasts and safe to spend. */
export const isPlanOpen = (item: { status?: string }) => item.status !== 'done';

export type PlannedItem = {
  id: string;
  name: string;
  type: PlannedItemType;
  amountLow: number;
  amountHigh: number;
  /** YYYY-MM-DD */
  date: string;
  status: PlannedItemStatus;
  categoryId?: string | null;
  category?: { name: string; icon?: string; color?: string } | null;
  notes?: string | null;
};

export type SavePlannedItemData = {
  name: string;
  type: PlannedItemType;
  amountLow: number;
  amountHigh: number;
  date: string;
  status: PlannedItemStatus;
  categoryId?: string | null;
  notes?: string | null;
};

export type UpdatePlannedItemData = SavePlannedItemData & { id: string };
