import { wallet } from "ionicons/icons";

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'completed' | 'pending' | 'cancelled';

export type CreateTransactionData = {
  walletId: string;
  categoryId?: string;
  amount: number;
  type: TransactionType;
  description?: string;
  date?: string;
  attachments?: string[];
  tags?: string[];
  toWalletId?: string;
  billId?: string;
  serviceFee?: number;
  /** False saves the transaction without changing any wallet balance (history, fixes). */
  affectsBalance?: boolean;
};

export type ListTransactionsParams = {
  page?: string;
  limit?: string;
  walletId?: string;
  /** A category id, or 'none' for uncategorized income and expenses. */
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  status?: TransactionStatus;
  tags?: string[];
};

export type UpdateTransactionData = {
  id: string;
  walletId?: string;
  categoryId?: string;
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: string;
  attachments?: string[];
  tags?: string[];
  status?: TransactionStatus;
  /** Leaves a one-off out of baseline spending (forecasts and the Claude connector). */
  excludeFromBaseline?: boolean;
  toWalletId?: string;
  /** Switching it takes the full amount out of (false) or puts it into (true) the wallet, once. */
  affectsBalance?: boolean;
};

export type SetAffectsBalanceRangeData = {
  /** yyyy-mm-dd, inclusive, in the device's time zone. */
  startDate: string;
  endDate: string;
  affectsBalance: boolean;
  walletId?: string;
  /** Also take out (or put in) each switched row's amount. Off keeps every balance as it is. */
  adjustBalances?: boolean;
};

export type WalletReconcileRow = {
  walletId: string;
  name: string;
  type: string;
  currency: string;
  status: string;
  storedBalance: number;
  transactionBalance: number;
  difference: number;
  balanceTransactions: number;
  nonBalanceTransactions: number;
};

export type DeleteTransactionData = {
  id: string;
};

export type GetMonthlyReportParams = {
  month?: string;
  year?: string;
  walletId?: string;
  categoryId?: string;
};

export type GetCategoryBreakdownParams = {
  type: TransactionType;
  startDate?: string;
  endDate?: string;
  walletId?: string;
};

export type ImportTransactionsData = {
  file: File;
  walletId: string;
  categoryId?: string;
  preview?: string | boolean;
}

export type transactionsSummaryParams = {
  month?: string;
  year?: string;
  walletId?: string;
}

export type quickStatsTransactionParams = {
  period: string; // today, week, month, year, all
  /** Steps back (negative) from the current period; Supabase backend only. */
  offset?: number;
  walletId?: string;
  type?: TransactionType;
}