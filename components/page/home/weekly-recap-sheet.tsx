'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Send } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { recapText, shareText, type WeeklyRecap } from '@/utils/retention'

/** Last week in a few lines, to share. Amounts are left out unless you switch them on. */
export function WeeklyRecapSheet({ recap, open, onOpenChange }: { recap: WeeklyRecap; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currency } = useSettingsStore()
  const [amounts, setAmounts] = useState(false)
  const text = recapText(recap, (n) => formatMoney(n, currency), amounts)

  const share = async () => {
    try {
      const result = await shareText(text, 'My week in Fico')
      if (result === 'copied') toast.success('Recap copied')
      if (result !== 'cancelled') onOpenChange(false)
    } catch {
      toast.error('Could not share the recap')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0 sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-b-0 pb-2">
          <SheetTitle>Last week</SheetTitle>
          <SheetDescription>A short recap you can share.</SheetDescription>
        </SheetHeader>
        <div data-vaul-no-drag className="space-y-3 px-4 pb-6">
          <p className="whitespace-pre-line rounded-2xl border border-border bg-secondary/40 p-4 text-[15px] leading-relaxed text-foreground">{text}</p>
          <label className="flex items-center justify-between gap-3 px-1 text-sm text-foreground">
            Include amounts
            <Switch checked={amounts} onCheckedChange={setAmounts} aria-label="Include amounts" />
          </label>
          <button type="button" onClick={share} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
            <Send className="h-4 w-4" />
            Share recap
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
