'use client'

import { Plus, Search, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BudgetsHeaderProps {
  onAddBudget: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function BudgetsHeader({
  onAddBudget,
  searchQuery,
  onSearchChange,
}: BudgetsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Budget Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Plan, track, and stay within your financial goals.</p>
        </div>
        <Button onClick={onAddBudget} className="flex items-center gap-2 h-11 px-5 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="w-5 h-5" />
          Create New Budget
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Find a budget..."
            className="pl-10 h-11 bg-card border-border/50 focus:border-primary/50 transition-all rounded-xl"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none h-11 gap-2 rounded-xl border-border/50 bg-card hover:bg-secondary/50">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Category
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none h-11 gap-2 rounded-xl border-border/50 bg-card hover:bg-secondary/50">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            March 2026
          </Button>
        </div>
      </div>
    </div>
  )
}
