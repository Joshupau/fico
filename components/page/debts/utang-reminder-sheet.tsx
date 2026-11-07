'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { MessageCircle, Send } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { cn } from '@/lib/utils'
import { REMINDER_TONES, shareText, utangMessage, type ReminderTone } from '@/utils/retention'
import type { Obligation } from '@/types/obligation'

/** A ready-to-send reminder for money someone owes you. You can edit it before sharing. */
export function UtangReminderSheet({ obligation, open, onOpenChange }: { obligation: Obligation; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { currency } = useSettingsStore()
  const [tone, setTone] = useState<ReminderTone>('gentle')
  const [edited, setEdited] = useState<string | null>(null)

  // Amounts always show here: the message is for the person who owes you.
  const money = (value: number) => formatMoney(value, obligation.currency || currency)
  const draft = utangMessage(
    { counterparty: obligation.counterparty, name: obligation.name, remaining: Number(obligation.remainingBalance) || 0, dueDate: obligation.dueDate, money },
    tone
  )
  const text = edited ?? draft
  const phone = (obligation.counterpartyContact ?? '').replace(/[^\d+]/g, '')

  const share = async () => {
    try {
      const result = await shareText(text)
      if (result === 'copied') toast.success('Copied. Paste it in your chat app.')
      if (result !== 'cancelled') onOpenChange(false)
    } catch {
      toast.error('Could not share or copy the message')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0 sm:max-w-md" showCloseButton={false}>
        <SheetHeader className="border-b-0 pb-2">
          <SheetTitle>Remind {obligation.counterparty}</SheetTitle>
          <SheetDescription>Friendly and short. Edit anything before you send it.</SheetDescription>
        </SheetHeader>
        <div data-vaul-no-drag className="space-y-3 px-4 pb-6">
          <div role="radiogroup" aria-label="Tone" className="flex gap-1 rounded-full bg-secondary p-1">
            {REMINDER_TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={tone === t.value}
                onClick={() => {
                  setTone(t.value)
                  setEdited(null)
                }}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                  tone === t.value ? 'bg-card text-foreground shadow-ios' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            rows={5}
            aria-label="Message"
            className="w-full resize-none rounded-2xl border border-border bg-secondary/40 p-3 text-[15px] leading-relaxed text-foreground outline-none focus:border-primary/60"
          />
          <div className="flex gap-2">
            {phone && (
              <a
                href={`sms:${phone}?&body=${encodeURIComponent(text)}`}
                onClick={() => onOpenChange(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card py-3 text-sm font-semibold text-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                Text
              </a>
            )}
            <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
              <Send className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
