export type WalletType = 'bank' | 'cash' | 'ewallet' | 'credit_card' | 'other';
export type WalletStatus = 'active' | 'archived';

export type CreateWalletData = {
  name: string;
  type: WalletType;
  balance?: number;
  currency?: string;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
};

export type UpdateWalletData = {
  id: string;
  name?: string;
  type?: WalletType;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
  status?: WalletStatus;
};

export type AdjustBalanceData = {
  id: string;
  amount: number;
  description?: string;
};

export type SetBalanceData = {
  id: string;
  balance: number;
};

export type ArchiveWalletData = {
  id: string;
};

export type ListWalletsParams = {
  page?: string;
  limit?: string;
  type?: WalletType;
  currency?: string;
  status?: WalletStatus;
};

export type GetWalletParams = {
  id: string;
};
