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

export const useCreateCategory = () => {
  return useMutation({
    mutationFn: (data: CreateCategoryData) => createCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// List Categories — includes global (owner_id null) categories per RLS.
const listCategories = async (params: ListCategoriesParams) => {
  if (isSupabase()) {
    const page = parseInt(params.page ?? '0') || 0;
    const limit = parseInt(params.limit ?? '50') || 50;
    let query = supabase.from('categories').select('*', { count: 'exact' }).eq('status', 'active');
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
    const { id, ...rest } = data;
    const { error } = await supabase
      .from('categories')
      .update({ name: rest.name, icon: rest.icon, color: rest.color, status: rest.status })
      .eq('id', id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/category/update", data);
  return response.data;
};

export const useUpdateCategory = () => {
  return useMutation({
    mutationFn: (data: UpdateCategoryData) => updateCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Archive Category
const archiveCategory = async (data: ArchiveCategoryData) => {
  if (isSupabase()) {
    const { error } = await supabase.from('categories').update({ status: 'archived' }).eq('id', data.id);
    if (error) throw error;
    return { message: 'success' };
  }
  const response = await axiosInstance.post("/category/archive", data);
  return response.data;
};

export const useArchiveCategory = () => {
  return useMutation({
    mutationFn: (data: ArchiveCategoryData) => archiveCategory(data),
    onError: (error) => {
      handleApiError(error);
    },
  });
};

// Get Category Summary
const getCategorySummary = async () => {
  if (isSupabase()) {
    const [{ count: totalIncome }, { count: totalExpense }, { count: userCreated }, { count: defaultCategories }] =
      await Promise.all([
        supabase.from('categories').select('*', { count: 'exact', head: true }).eq('type', 'income').eq('status', 'active'),
        supabase.from('categories').select('*', { count: 'exact', head: true }).eq('type', 'expense').eq('status', 'active'),
        supabase.from('categories').select('*', { count: 'exact', head: true }).eq('status', 'active').not('owner_id', 'is', null),
        supabase.from('categories').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('is_default', true).is('owner_id', null),
      ]);
    return {
      message: 'success',
      data: { totalIncome, totalExpense, userCreated, defaultCategories },
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
