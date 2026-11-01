// /api/v1/categories routes

import { axiosInstance } from "@/utils/axios-instance";
import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreateCategoryData,
  UpdateCategoryData,
  ArchiveCategoryData,
  DeleteCategoryData,
  ListCategoriesParams,
} from "@/types/category";

const isSupabase = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase';

// Create Category — duplicate-name check happens server-side in the RPC
// (categories_create), since it needs a race-safe existence check.
const createCategory = async (data: CreateCategoryData) => {
  if (isSupabase()) {
    const { data: row, error } = await supabase.rpc('categories_create', {
      p_name: data.name,
      p_type: data.type,
      p_icon: data.icon ?? null,
      p_color: data.color ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/category/create", data);
  return response.data;
};

// Categories show up in forms, budget cards, transaction lists and reports all over the app, and
// the first change to a default category moves every transaction onto the user's own copy
// (migration 0060), so any change refreshes everything.
const useRefreshCategories = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
};

export const useCreateCategory = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: CreateCategoryData) => createCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Once a user has changed a default category they get their own copy of every default
// (categories_make_own, migration 0060), and the shared defaults are hidden from them.
const getOwnsCategories = async (): Promise<boolean> => {
  const { data, error } = await supabase.from('profiles').select('owns_categories').maybeSingle();
  // Before migration 0060 the column doesn't exist yet: everyone still sees the shared defaults.
  if (error) return false;
  return !!data?.owns_categories;
};

// List Categories — includes global (owner_id null) categories per RLS, until the user owns their
// own copies. Archived categories only come back when asked for (status: 'archived'), so they
// never show up in pickers.
const listCategories = async (params: ListCategoriesParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '50') || 50;
    const ownsCategories = await getOwnsCategories();
    let query = supabase.from('categories').select('*', { count: 'exact' }).eq('status', params.status ?? 'active');
    if (ownsCategories) query = query.not('owner_id', 'is', null);
    if (params.type) query = query.eq('type', params.type);
    if (params.search) query = query.ilike('name', `%${params.search}%`);
    const { data, count, error } = await query
      .order('name', { ascending: true })
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
  const response = await axiosInstance.get("/category/list", { params });
  return response.data;
};

export const useListCategories = (params?: ListCategoriesParams) => {
  return useQuery({
    queryKey: ["categories", params],
    queryFn: () => listCategories(params || {}),
    enabled: true,
  });
};

// Update Category
const updateCategory = async (data: UpdateCategoryData) => {
  if (isSupabase()) {
    // Through the RPC rather than a plain update, so a default category (a shared row nobody can
    // write) becomes the user's own copy first.
    const { data: row, error } = await supabase.rpc('categories_update', {
      p_id: data.id,
      p_name: data.name ?? null,
      p_icon: data.icon ?? null,
      p_color: data.color ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: toCamelCase(row) };
  }
  const response = await axiosInstance.post("/category/update", data);
  return response.data;
};

export const useUpdateCategory = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: UpdateCategoryData) => updateCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Categories left out of baseline spending (travel, ATM cash, one-offs). The list lives on the
// user's profile rather than on each category, because the default categories are shared rows.
const getBaselineExcludedCategoryIds = async (): Promise<string[]> => {
  if (!isSupabase()) return [];
  const { data, error } = await supabase.from('profiles').select('baseline_excluded_category_ids').maybeSingle();
  if (error) throw error;
  return data?.baseline_excluded_category_ids ?? [];
};

export const useBaselineExcludedCategoryIds = () => {
  return useQuery({
    queryKey: ['categories', 'baseline-excluded'],
    queryFn: () => getBaselineExcludedCategoryIds(),
    enabled: true,
  });
};

const setCategoryExcludeFromBaseline = async (data: { id: string; exclude: boolean }) => {
  if (!isSupabase()) return { message: 'success' };
  const { error } = await supabase.rpc('categories_set_exclude_from_baseline', {
    p_id: data.id,
    p_exclude: data.exclude,
  });
  if (error) throw error;
  return { message: 'success' };
};

export const useSetCategoryExcludeFromBaseline = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: { id: string; exclude: boolean }) => setCategoryExcludeFromBaseline(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Category — hides it from pickers; transactions keep it.
const archiveCategory = async (data: ArchiveCategoryData) => {
  if (isSupabase()) {
    const { error } = await supabase.rpc('categories_archive', { p_id: data.id });
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/category/archive", data);
  return response.data;
};

export const useArchiveCategory = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: ArchiveCategoryData) => archiveCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Unarchive Category — back in every picker.
const unarchiveCategory = async (data: ArchiveCategoryData) => {
  if (isSupabase()) {
    const { error } = await supabase.rpc('categories_unarchive', { p_id: data.id });
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/category/update", { id: data.id, status: 'active' });
  return response.data;
};

export const useUnarchiveCategory = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: ArchiveCategoryData) => unarchiveCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Delete Category — its transactions, bills and budgets move to replacementId, or become
// uncategorized without one.
const deleteCategory = async (data: DeleteCategoryData) => {
  if (isSupabase()) {
    const { data: result, error } = await supabase.rpc('categories_delete', {
      p_id: data.id,
      p_replacement_id: data.replacementId ?? null,
    });
    if (error) throw error;
    return { message: 'success', data: result };
  }
  const response = await axiosInstance.post("/category/delete", data);
  return response.data;
};

export const useDeleteCategory = () => {
  const refreshCategories = useRefreshCategories();
  return useMutation({
    onSuccess: refreshCategories,
    mutationFn: (data: DeleteCategoryData) => deleteCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Category Summary — also feeds CategoryOverview's "Top Category" /
// "Total Budget" / "Budget Alerts" tiles, which nothing above ever
// populated (mostUsedCategory/totalBudget/budgetAlerts weren't part of this
// endpoint's response even before the Supabase migration), so those tiles
// always read "None" / ₱0.00 / 0 regardless of actual data.
const getCategorySummary = async () => {
  if (isSupabase()) {
    const [
      { count: totalIncome },
      { count: totalExpense },
      { count: userCreated },
      { count: defaultCategories },
      { data: expenseBreakdown },
      { data: incomeBreakdown },
      { data: budgetSummary },
    ] = await Promise.all([
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('type', 'income').eq('status', 'active'),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('type', 'expense').eq('status', 'active'),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('status', 'active').not('owner_id', 'is', null),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('is_default', true).is('owner_id', null),
      supabase.rpc('reports_category_breakdown', { p_type: 'expense', p_period: 'all' }),
      supabase.rpc('reports_category_breakdown', { p_type: 'income', p_period: 'all' }),
      supabase.rpc('budgets_summary'),
    ]);

    const breakdownRows = [
      ...(expenseBreakdown?.breakdown ?? []),
      ...(incomeBreakdown?.breakdown ?? []),
    ];
    const mostUsed = breakdownRows.reduce(
      (top: any, row: any) => (!top || row.count > top.count ? row : top),
      null as any
    );

    return {
      message: 'success',
      data: {
        totalIncome,
        totalExpense,
        userCreated,
        defaultCategories,
        mostUsedCategory: mostUsed ? { name: mostUsed.categoryName } : null,
        totalBudget: budgetSummary?.totalBudgeted ?? 0,
        budgetAlerts: budgetSummary?.exceededBudgets ?? 0,
      },
    };
  }
  const response = await axiosInstance.get("/category/summary");
  return response.data;
};

export const useCategorySummary = () => {
  return useQuery({
    queryKey: ["category-summary"],
    queryFn: () => getCategorySummary(),
    enabled: true,
  });
};
