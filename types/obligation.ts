export type ObligationDirection = 'debt' | 'lending';
export type InterestType = 'simple' | 'compound';
export type ObligationStatus = 'active' | 'partially_paid' | 'settled' | 'defaulted' | 'archived';
export type InstallmentFrequency = 'weekly' | 'monthly' | 'yearly';

export type Obligation = {
  id: string;
  direction: ObligationDirection;
  name: string;
  counterparty: string;
  counterpartyContact?: string;
  principalAmount: number;
  remainingBalance: number;
  currency: string;
  interestRate?: number;
  interestType?: InterestType;
  totalWithInterest?: number;
  startDate: string;
  dueDate?: string;
  walletId?: string;
  wallet?: { name: string; type: string };
  categoryId?: string;
  category?: { name: string; icon?: string; color?: string };
  notes?: string;
  tags: string[];
  status: ObligationStatus;
  isInstallment: boolean;
  installmentAmount?: number;
  totalInstallments?: number;
  paidInstallments: number;
  installmentFrequency?: InstallmentFrequency;
};

export type CreateObligationData = {
  direction: ObligationDirection;
  name: string;
  counterparty: string;
  counterpartyContact?: string;
  principalAmount: number;
  startDate: string;
  currency?: string;
  interestRate?: number;
  interestType?: InterestType;
  dueDate?: string;
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  isInstallment?: boolean;
  installmentAmount?: number;
  totalInstallments?: number;
  installmentFrequency?: InstallmentFrequency;
};

export type UpdateObligationData = {
  id: string;
  name?: string;
  counterparty?: string;
  counterpartyContact?: string;
  dueDate?: string;
  interestRate?: number;
  interestType?: InterestType;
  walletId?: string;
  categoryId?: string;
  notes?: string;
  tags?: string[];
  status?: ObligationStatus;
};

export type RecordObligationPaymentData = {
  id: string;
  amount: number;
  walletId: string;
  date?: string;
  notes?: string;
  idempotencyKey?: string;
};

export type ListObligationsParams = {
  page?: string;
  limit?: string;
  direction?: ObligationDirection;
  status?: ObligationStatus;
  isInstallment?: string;
};
