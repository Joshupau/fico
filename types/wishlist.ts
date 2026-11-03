export type WishlistPriority = 'need' | 'want' | 'someday';
export type WishlistStatus = 'wanted' | 'bought';

export type WishlistItem = {
  id: string;
  name: string;
  price: number;
  priority: WishlistPriority;
  /** YYYY-MM-DD, when the user wants to have it by. */
  targetDate?: string | null;
  url?: string | null;
  notes?: string | null;
  status: WishlistStatus;
  /** YYYY-MM-DD */
  boughtOn?: string | null;
  createdAt?: string;
};

export type SaveWishlistItemData = {
  name: string;
  price: number;
  priority: WishlistPriority;
  targetDate?: string | null;
  url?: string | null;
  notes?: string | null;
};

export type UpdateWishlistItemData = SaveWishlistItemData & { id: string };
