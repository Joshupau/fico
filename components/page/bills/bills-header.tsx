import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'

interface BillsHeaderProps {
  isRefreshing?: boolean
  onRefresh: () => void
  onCreate: () => void
}

export function BillsHeader({ isRefreshing, onRefresh, onCreate }: BillsHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-success/5 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">Bills & Income</h1>
            <p className="text-sm text-muted-foreground mt-1">Track recurring expenses, income entries, due dates, and payment health in one view.</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" className="gap-2 rounded-full" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="gap-2 rounded-full" onClick={onCreate}>
              <Plus className="w-4 h-4" />
              New Entry
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
