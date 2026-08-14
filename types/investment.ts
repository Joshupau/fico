export type InvestmentType = 'stocks' | 'bonds' | 'mutual_funds' | 'crypto' | 'real_estate' | 'savings' | 'other';
export type InvestmentStatus = 'active' | 'matured' | 'sold' | 'archived';

export type ValueSnapshot = {
  value: number;
  snapshotDate: string;
  notes?: string;
};

export type Investment = {
  id: string;
  name: string;
  type: InvestmentType;
  principalAmount: number;
  currentValue: number;
  currency: string;
  platform?: string;
  walletId?: string;
  wallet?: { name: string; type: string };
  categoryId?: string;
  category?: { name: string; icon?: string; color?: string };
  startDate: string;
  maturityDate?: string;
  expectedReturnRate?: number;
  dividendsReceived: number;
  notes?: string;
  tags: string[];
  status: InvestmentStatus;
};

export type CreateInvestmentData = {
  name: string;
  type: InvestmentType;
  principalAmount: number;
  startDate: string;
  currency?: string;
  platform?: string;
  walletId?: string;
  categoryId?: string;
  maturityDate?: string;
  expectedReturnRate?: number;
  notes?: string;
  tags?: string[];
};

export type UpdateInvestmentData = {
  id: string;
  name?: string;
  platform?: string;
  maturityDate?: string;
  expectedReturnRate?: number;
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  status?: InvestmentStatus;
};

export type UpdateInvestmentValueData = {
  id: string;
  value: number;
  date?: string;
  notes?: string;
};

export type RecordInvestmentReturnData = {
  id: string;
  amount: number;
  walletId: string;
  date?: string;
  notes?: string;
};

export type SellInvestmentData = {
  id: string;
  saleAmount: number;
  walletId: string;
  date?: string;
  notes?: string;
};

export type ListInvestmentsParams = {
  page?: string;
  limit?: string;
  type?: InvestmentType;
  status?: InvestmentStatus;
};
