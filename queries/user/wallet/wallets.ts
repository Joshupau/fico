// /api/v1/wallet routes

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateWalletData,
  UpdateWalletData,
  AdjustBalanceData,
  ArchiveWalletData,
  ListWalletsParams,
  GetWalletParams,
} from "@/types/wallet";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Create Wallet — simple single-table insert, direct client call (layer (a)).
const createWallet = async (data: CreateWalletData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase
      .from('wallets')
      .insert({
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
        currency: data.currency ?? 'PHP',
        icon: data.icon,
        color: data.color,
        description: data.description,
        account_number: data.accountNumber,
      })
      .select()
      .single();
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/wallet/create", data);
  return response.data;
};

export const useCreateWallet = () => {
  return useMutation({
    mutationFn: (data: CreateWalletData) => createWallet(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Wallets
const listWallets = async (params: ListWalletsParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '20') || 20;
    let query = supabase.from('wallets').select('*', { count: 'exact' });
    query = query.eq('status', params.status ?? 'active');
    if (params.type) query = query.eq('type', params.type);
    if (params.currency) query = query.eq('currency', params.currency);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    if (error) throw error;
    return {
      message: 'success',
      data: {
        items: toCamelCase(data ?? []),
        totalPages: Math.ceil((count ?? 0) / limit),
        currentPage: page,
        totalItems: count ?? 0,
      },
    };
  }
  const response = await axiosInstance.get("/wallet/list", { params });
  return response.data;
};

export const useListWallets = (params?: ListWalletsParams) => {
  return useQuery({
    queryKey: ["wallets", params],
    queryFn: () => listWallets(params || {}),
    enabled: true,
  });
};

// Get Wallet by ID
const getWallet = async (params: GetWalletParams) => {
  if (isSupabase()) {
    const { data, error } = await supabase.from('wallets').select('*').eq('id', params.id).single();
    if (error) throw error;
    return { message: 'success', data: toCamelCase(data) };
  }
  const response = await axiosInstance.get("/wallet/get", { params });
  return response.data;
};

export const useGetWallet = (params?: GetWalletParams) => {
  return useQuery({
    queryKey: ["wallet", params],
    queryFn: () => getWallet(params || { id: "" }),
    enabled: !!params?.id,
  });
};

// Update Wallet
const updateWallet = async (data: UpdateWalletData) => {
  if (isSupabase()) {
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('wallets')
      .update({
        name: rest.name,
        type: rest.type,
        icon: rest.icon,
        color: rest.color,
        description: rest.description,
        account_number: rest.accountNumber,
        status: rest.status,
      })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/wallet/update", data);
  return response.data;
};

export const useUpdateWallet = () => {
  return useMutation({
    mutationFn: (data: UpdateWalletData) => updateWallet(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Adjust Balance — mutates a running total, goes through the
// wallets_adjust_balance RPC so the update stays atomic (layer (b)).
const adjustBalance = async (data: AdjustBalanceData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('wallets_adjust_balance', {
      p_wallet_id: data.id,
      p_amount: data.amount,
    });
    if (error) throw error;
    return { message: 'success', data: { newBalance: row.balance } };
  }
  const response = await axiosInstance.post("/wallet/adjust-balance", data);
  return response.data;
};

export const useAdjustBalance = () => {
  return useMutation({
    mutationFn: (data: AdjustBalanceData) => adjustBalance(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Wallet
const archiveWallet = async (data: ArchiveWalletData) => {
  if (isSupabase()) {
    const { error } = await supabase.from('wallets').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/wallet/archive", data);
  return response.data;
};

export const useArchiveWallet = () => {
  return useMutation({
    mutationFn: (data: ArchiveWalletData) => archiveWallet(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Total Balance
const getTotalBalance = async (params: ListWalletsParams) => {
  if (isSupabase()) {
    let query = supabase.from('wallets').select('balance, currency').eq('status', 'active');
    if (params.currency) query = query.eq('currency', params.currency);
    const { data, error } = await query;
    if (error) throw error;
    const balancesByCurrency: Record<string, number> = {};
    for (const w of data ?? []) {
      balancesByCurrency[w.currency] = (balancesByCurrency[w.currency] ?? 0) + Number(w.balance);
    }
    return { message: 'success', data: { balancesByCurrency, walletCount: data?.length ?? 0 } };
  }
  const response = await axiosInstance.get("/wallet/total-balance", { params });
  return response.data;
};

export const useTotalBalance = (params?: ListWalletsParams) => {
  return useQuery({
    queryKey: ["wallet-total-balance", params],
    queryFn: () => getTotalBalance(params || {}),
    enabled: true,
  });
};
