// Wishlist: things you want to buy, with a price, how much you want it and an optional date.
// Plain table reads and writes (no RPC), so they also work offline. The Fico MCP server reads the
// same table (read-only). Supabase only: there is no legacy API route for it.

import { supabase } from "@/utils/supabase-client";
import { toCamelCase } from "@/utils/case-transform";
import { handleApiError } from "@/utils/error-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SaveWishlistItemData, UpdateWishlistItemData, WishlistItem } from "@/types/wishlist";

const assertSupabase = () => {
  if (process.env.NEXT_PUBLIC_BACKEND !== 'supabase') {
    throw new Error('The wishlist needs the Supabase backend.');
  }
};

const toRow = (data: SaveWishlistItemData) => ({
  name: data.name,
  price: data.price,
  priority: data.priority,
  target_date: data.targetDate || null,
  url: data.url || null,
  notes: data.notes || null,
});

const day = (value: unknown) => (value ? String(value).slice(0, 10) : null);

export const useListWishlist = () =>
  useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      assertSupabase();
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return toCamelCase<WishlistItem[]>(data ?? []).map((item) => ({
        ...item,
        price: Number(item.price) || 0,
        targetDate: day(item.targetDate),
        boughtOn: day(item.boughtOn),
      }));
    },
  });

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["wishlist"] });
};

export const useCreateWishlistItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: SaveWishlistItemData) => {
      assertSupabase();
      const { error } = await supabase.from('wishlist_items').insert(toRow(data));
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

export const useUpdateWishlistItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateWishlistItemData) => {
      assertSupabase();
      const { error } = await supabase.from('wishlist_items').update(toRow(data)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

/** Marks an item bought (on a date, default today) or back to wanted. It only moves the item: log the purchase itself as a transaction. */
export const useSetWishlistBought = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, boughtOn }: { id: string; boughtOn: string | null }) => {
      assertSupabase();
      const { error } = await supabase
        .from('wishlist_items')
        .update({ status: boughtOn ? 'bought' : 'wanted', bought_on: boughtOn })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};

export const useDeleteWishlistItem = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertSupabase();
      const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => handleApiError(error),
  });
};
