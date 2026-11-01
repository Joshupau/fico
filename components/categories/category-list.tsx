'use client'
import { EmptyState } from '@/components/peacock-mascot'
import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Plus, Hash, LayoutGrid, List } from 'lucide-react'
import CategoryModal from './category-modal'
import {
  useListCategories,
  useArchiveCategory,
  useUnarchiveCategory,
  useDeleteCategory,
} from '@/queries/user/category/categories'
import { useTopCategories } from '@/queries/user/transaction/transaction'
import { CategoryCard, CategoryActions } from '@/components/page/categories/category-card'
import { DeleteCategoryDialog } from '@/components/page/categories/delete-category-dialog'

interface CategoryViewModel {
  id: string
  name: string
  type: 'income' | 'expense'
  icon?: string
  color?: string
  status?: 'active' | 'archived'
  transactionCount?: number
}

interface CategoryApiItem {
  _id?: string
  id?: string
  name?: string
  type?: string
  icon?: string
  color?: string
  status?: string
}

const normalizeCategory = (
  category: CategoryApiItem,
  index: number,
  transactionCountByCategoryId: Record<string, number>
): CategoryViewModel => {
  const resolvedId = category._id ?? category.id ?? `category-${index}`

  return {
    id: resolvedId,
    name: category.name || 'Untitled Category',
    type: (category.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
    icon: category.icon,
    color: category.color,
    status: (category.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
    transactionCount: transactionCountByCategoryId[resolvedId] ?? 0,
  }
}

export default function CategoryList({ searchQuery = '' }: { searchQuery?: string }) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryViewModel | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryViewModel | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [statusView, setStatusView] = useState<'active' | 'archived'>('active')

  const { data: activeResponse, isLoading: activeLoading } = useListCategories({ limit: '200' })
  const { data: archivedResponse, isLoading: archivedLoading } = useListCategories({ limit: '200', status: 'archived' })
  const categoryResponse = statusView === 'archived' ? archivedResponse : activeResponse
  const isLoading = statusView === 'archived' ? archivedLoading : activeLoading
  const { mutate: archiveCategory } = useArchiveCategory()
  const { mutate: unarchiveCategory } = useUnarchiveCategory()
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory()
  const { data: expenseBreakdownResponse } = useTopCategories({ period: 'all', type: 'expense' })
  const { data: incomeBreakdownResponse } = useTopCategories({ period: 'all', type: 'income' })

  const transactionCountByCategoryId = useMemo(() => {
    const rows = [
      ...(expenseBreakdownResponse?.data?.breakdown ?? []),
      ...(incomeBreakdownResponse?.data?.breakdown ?? []),
    ]
    return rows.reduce((acc: Record<string, number>, row: any) => {
      if (row.categoryId) acc[row.categoryId] = row.count
      return acc
    }, {})
  }, [expenseBreakdownResponse, incomeBreakdownResponse])

  const toViewModels = (response: typeof activeResponse) => {
    const responseData = response?.data as
      | CategoryApiItem[]
      | { items?: CategoryApiItem[]; categories?: CategoryApiItem[] }
      | undefined
    const items = Array.isArray(responseData)
      ? responseData
      : responseData?.items ?? responseData?.categories ?? []
    return items.map((category, categoryIndex) => normalizeCategory(category, categoryIndex, transactionCountByCategoryId))
  }

  const activeCategories = useMemo(
    () => toViewModels(activeResponse),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeResponse, transactionCountByCategoryId]
  )

  const categories = useMemo(() => {
    const all = statusView === 'archived' ? toViewModels(categoryResponse) : activeCategories
    const query = searchQuery.trim().toLowerCase()
    return query ? all.filter((c) => c.name.toLowerCase().includes(query)) : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusView, categoryResponse, activeCategories, searchQuery, transactionCountByCategoryId])

  const archivedCount = useMemo(() => toViewModels(archivedResponse).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [archivedResponse])

  const findCategory = (id: string) => categories.find((c) => c.id === id) ?? null

  const handleArchive = (categoryId: string) => {
    archiveCategory(
      { id: categoryId },
      { onSuccess: () => toast.success('Category archived. It stays on past transactions.') }
    )
  }

  const handleUnarchive = (categoryId: string) => {
    unarchiveCategory({ id: categoryId }, { onSuccess: () => toast.success('Category restored') })
  }

  const handleDelete = (replacementId: string | null) => {
    if (!deletingCategory) return
    deleteCategory(
      { id: deletingCategory.id, replacementId },
      {
        onSuccess: () => {
          toast.success('Category deleted')
          setDeletingCategory(null)
        },
      }
    )
  }

  const actions = {
    onEdit: (id: string) => setSelectedCategory(findCategory(id)),
    onArchive: handleArchive,
    onUnarchive: handleUnarchive,
    onDelete: (id: string) => setDeletingCategory(findCategory(id)),
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl">
          <Button
            size="sm"
            variant={statusView === 'active' ? 'secondary' : 'ghost'}
            className="h-8 rounded-md"
            onClick={() => setStatusView('active')}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={statusView === 'archived' ? 'secondary' : 'ghost'}
            className="h-8 rounded-md"
            onClick={() => setStatusView('archived')}
          >
            Archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
          </Button>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl">
          <Button
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            className="h-8 w-8 rounded-md"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            className="h-8 w-8 rounded-md"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {categories.map((c) => (
            viewMode === 'grid' ? (
              <CategoryCard 
                key={c.id} 
                {...c}
                {...actions}
              />
            ) : (
              <div
                key={c.id}
                className={`p-4 bg-card border border-border rounded-xl flex justify-between items-center hover:border-primary/30 transition-all duration-300 ${
                  c.status === 'archived' ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon || <Hash className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {c.type}{c.status === 'archived' ? ' · Archived' : ''}
                    </div>
                  </div>
                </div>
                <CategoryActions id={c.id} status={c.status} {...actions} />
              </div>
            )
          ))}
        </div>
      ) : statusView === 'archived' || searchQuery.trim() ? (
        <div className="px-6 py-12 bg-card/30 border border-dashed border-border rounded-2xl">
          <EmptyState
            pose="advisor"
            title={searchQuery.trim() ? 'No matching categories' : 'No archived categories'}
            description={searchQuery.trim() ? 'Try a different name.' : 'Categories you archive show up here, ready to bring back.'}
          />
        </div>
      ) : (
        <div className="px-6 py-12 bg-card/30 border border-dashed border-border rounded-2xl">
          <EmptyState pose="advisor" title="No categories found in your account" description="Categories help you see where your money goes.">
            <Button size="lg" className="rounded-full px-8" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Category
            </Button>
          </EmptyState>
        </div>
      )}

      <CategoryModal open={open} onClose={() => setOpen(false)} />
      <CategoryModal open={!!selectedCategory} onClose={() => setSelectedCategory(null)} category={selectedCategory} />
      <DeleteCategoryDialog
        open={!!deletingCategory}
        onOpenChange={(nextOpen) => !nextOpen && setDeletingCategory(null)}
        onConfirm={handleDelete}
        categoryName={deletingCategory?.name ?? ''}
        transactionCount={deletingCategory?.transactionCount ?? 0}
        replacements={activeCategories.filter((c) => c.type === deletingCategory?.type && c.id !== deletingCategory?.id)}
        isDeleting={isDeleting}
      />
    </div>
  )
}

