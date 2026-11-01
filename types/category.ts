export type CategoryType = 'income' | 'expense';
export type CategoryStatus = 'active' | 'archived';

export type CreateCategoryData = {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
};

export type UpdateCategoryData = {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  status?: CategoryStatus;
};

export type ArchiveCategoryData = {
  id: string;
};

export type DeleteCategoryData = {
  id: string;
  /** Category of the same type that takes over its transactions; none = uncategorized. */
  replacementId?: string | null;
};

export type ListCategoriesParams = {
  status?: CategoryStatus;
  page?: string;
  limit?: string;
  type?: CategoryType;
  search?: string;
  includeDefault?: string;
};
