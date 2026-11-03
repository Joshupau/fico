'use client'

import { extractArrayFromApiResponse } from '@/lib/api-response'

export type CategoryDatum = {
  id: string
  /** The category's id for filtering transactions; 'none' for uncategorized. */
  categoryId?: string
  name: string
  amount: number
  percentage: number
  color: string
}

export const STAT_CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#f97316']

const resolveNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const resolveName = (record: Record<string, unknown>, fallback: string): string => {
  const rawName = record.name ?? record.categoryName ?? record.label ?? record.title ?? record.key
  if (typeof rawName === 'string' && rawName.trim().length > 0) {
    return rawName
  }
  return fallback
}

export const normalizeCategoryData = (payload: unknown): CategoryDatum[] => {
  const items = extractArrayFromApiResponse<Record<string, unknown>>(payload, [
    'breakdown',
    'items',
    'categories',
    'topCategories',
    'dataPoints',
  ])

  if (!items.length) return []

  const rawTotals = items.map((item) => {
    const amount = resolveNumber(item.amount ?? item.value ?? item.total ?? item.spent ?? item.sum)
    return {
      item,
      amount,
    }
  })

  const grandTotal = rawTotals.reduce((sum, entry) => sum + entry.amount, 0)

  return rawTotals
    .map((entry, index) => {
      const item = entry.item
      const idValue = item._id ?? item.id ?? item.key ?? `${index}`
      const id = typeof idValue === 'string' ? idValue : String(idValue)
      const percentageValue = resolveNumber(item.percentage ?? item.share)
      const percentage = percentageValue > 0 ? percentageValue : grandTotal > 0 ? (entry.amount / grandTotal) * 100 : 0
      const categoryColor = item.categoryColor ?? item.color

      const rawCategoryId = 'categoryId' in item ? item.categoryId : (item._id ?? item.id)
      return {
        id,
        categoryId: rawCategoryId == null ? ('categoryId' in item ? 'none' : undefined) : String(rawCategoryId),
        name: resolveName(item, `Category ${index + 1}`),
        amount: entry.amount,
        percentage,
        color: typeof categoryColor === 'string' && categoryColor.trim().length > 0 ? categoryColor : STAT_CHART_COLORS[index % STAT_CHART_COLORS.length],
      }
    })
    .sort((left, right) => right.amount - left.amount)
}

export const getCategoryTotal = (items: CategoryDatum[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0)
}
