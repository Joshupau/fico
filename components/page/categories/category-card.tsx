'use client'

import { MoreVertical, Trash2, Edit2, Archive, ArchiveRestore, Hash, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CategoryActionsProps {
  id: string
  status?: 'active' | 'archived'
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

// Shared by the grid card and the list row. Opened from a tap as well as a hover, since the app
// runs on phones where nothing hovers.
export function CategoryActions({ id, status = 'active', onEdit, onArchive, onUnarchive, onDelete, className }: CategoryActionsProps) {
  const isArchived = status === 'archived'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg hover:bg-secondary ${className ?? ''}`} aria-label="Category actions">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isArchived && (
          <DropdownMenuItem onClick={() => requestAnimationFrame(() => onEdit?.(id))} className="gap-2">
            <Edit2 className="w-4 h-4" />
            <span>Edit Category</span>
          </DropdownMenuItem>
        )}
        {isArchived ? (
          <DropdownMenuItem onClick={() => onUnarchive?.(id)} className="gap-2">
            <ArchiveRestore className="w-4 h-4" />
            <span>Unarchive</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onArchive?.(id)} className="gap-2">
            <Archive className="w-4 h-4" />
            <span>Archive</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => requestAnimationFrame(() => onDelete?.(id))}
          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface CategoryCardProps {
  id: string
  name: string
  type: 'income' | 'expense'
  icon?: string
  color?: string
  status?: 'active' | 'archived'
  transactionCount?: number
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  onDelete?: (id: string) => void
}

export function CategoryCard({
  id,
  name,
  type,
  icon,
  color = '#6366f1', // Default indigo
  status = 'active',
  transactionCount = 0,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: CategoryCardProps) {
  const isArchived = status === 'archived'

  return (
    <div
      className={`group relative bg-gradient-to-br from-card to-secondary border border-border rounded-2xl p-5 shadow-ios hover:shadow-ios-lg transition-all duration-300 overflow-hidden ${
        isArchived ? 'opacity-70' : ''
      }`}
      style={{
        borderLeft: `4px solid ${color}`,
      }}
    >
      {/* Background accent */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-5 blur-2xl"
        style={{ backgroundColor: color }}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {icon ? (
               <span className="text-xl">{icon}</span>
            ) : (
              <Hash className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">{name}</h3>
              <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 ${
                type === 'income' ? 'text-success border-success/30 bg-success/5' : 'text-destructive border-destructive/30 bg-destructive/5'
              }`}>
                {type === 'income' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownLeft className="w-3 h-3 mr-0.5" />}
                {type}
              </Badge>
              {isArchived && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Archived</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {transactionCount} transactions
            </p>
          </div>
        </div>

        <CategoryActions
          id={id}
          status={status}
          onEdit={onEdit}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          className="md:opacity-0 md:group-hover:opacity-100 md:data-[state=open]:opacity-100 transition-opacity"
        />
      </div>
    </div>
  )
}
