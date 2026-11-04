'use client'

import { Heart, Sparkles, PiggyBank, Home, HandCoins, ShieldPlus, Utensils, Car, GraduationCap, Plane, Wallet, type LucideIcon } from 'lucide-react'

export const GROUP_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: 'heart', icon: Heart },
  { key: 'sparkles', icon: Sparkles },
  { key: 'piggy', icon: PiggyBank },
  { key: 'shield', icon: ShieldPlus },
  { key: 'home', icon: Home },
  { key: 'hand', icon: HandCoins },
  { key: 'food', icon: Utensils },
  { key: 'car', icon: Car },
  { key: 'school', icon: GraduationCap },
  { key: 'travel', icon: Plane },
  { key: 'wallet', icon: Wallet },
]

export const GROUP_COLORS = ['#0A84FF', '#AF52DE', '#34C759', '#FF9500', '#FF2D55', '#5AC8FA', '#FFCC00', '#8E8E93']

export const groupIcon = (key: string | null | undefined, kind: 'spend' | 'save' = 'spend'): LucideIcon =>
  GROUP_ICONS.find((i) => i.key === key)?.icon ?? (kind === 'save' ? PiggyBank : Wallet)

export function GroupBadge({ icon, kind, color, className = 'h-10 w-10' }: { icon: string | null; kind: 'spend' | 'save'; color: string | null; className?: string }) {
  const Icon = groupIcon(icon, kind)
  const tint = color || (kind === 'save' ? '#34C759' : '#0A84FF')
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl ${className}`} style={{ backgroundColor: `${tint}1F`, color: tint }}>
      <Icon className="h-5 w-5" />
    </div>
  )
}
