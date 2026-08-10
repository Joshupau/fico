'use client'

import { MoreVertical, Trash2, Edit2, Archive, Hash, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
}: CategoryCardProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className="group relative bg-gradient-to-br from-card to-secondary border border-border rounded-2xl p-5 shadow-ios hover:shadow-ios-lg transition-all duration-300 overflow-hidden"
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
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            {icon ? (
               <span className="text-xl">{icon}</span>
            ) : (
              <Hash className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{name}</h3>
              <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 ${
                type === 'income' ? 'text-success border-success/30 bg-success/5' : 'text-destructive border-destructive/30 bg-destructive/5'
              }`}>
                {type === 'income' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownLeft className="w-3 h-3 mr-0.5" />}
                {type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {transactionCount} transactions
            </p>
          </div>
        </div>

        {status === 'active' && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMenu(!showMenu)}
              className="h-8 w-8 rounded-lg hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </Button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-xl shadow-ios-lg py-1 z-50 animate-in fade-in zoom-in duration-200">
                  <button
                    onClick={() => {
                      onEdit?.(id)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Category
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => {
                      onArchive?.(id)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-secondary flex items-center gap-2 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {status === 'archived' && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-20">
          <Badge variant="secondary" className="bg-secondary/80">Archived</Badge>
        </div>
      )}
    </div>
  )
}
