'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { formatMoney } from '@/utils/formatter'
import { goalForecast } from '@/utils/goal-forecast'

export interface GoalDraft {
  name: string
  target: number
  monthly: number
  deadline: string
}

const IDEAS: { label: string; emoji: string; target: number }[] = [
  { label: 'Emergency fund', emoji: '🛟', target: 50_000 },
  { label: 'Travel', emoji: '✈️', target: 30_000 },
  { label: 'New phone', emoji: '📱', target: 40_000 },
  { label: 'Pay off a debt', emoji: '💳', target: 20_000 },
]

const amountOf = (text: string) => Number(text.replace(/[^0-9.]/g, '')) || 0

/**
 * Onboarding's first question: one goal, and when you'd reach it, before any other setup.
 * The goal is saved when onboarding finishes; skipping saves nothing.
 */
export function GoalStep({ currency, initial, onNext, onBack }: { currency: string; initial: GoalDraft | null; onNext: (goal: GoalDraft | null) => void; onBack: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial ? String(initial.target) : '')
  const [monthly, setMonthly] = useState(initial ? String(initial.monthly) : '')
  const money = (n: number) => formatMoney(n, currency).replace(/\.00$/, '')

  const forecast = goalForecast({ target: amountOf(target), monthly: amountOf(monthly) })
  const ready = name.trim() && forecast && forecast.months > 0

  const field =
    'w-full rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-4 py-3.5 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-gray-900 dark:focus:border-white'

  return (
    <div className="animate-fade-in">
      <h2 className="text-[24px] font-bold leading-tight text-gray-900 dark:text-white">What are you saving for?</h2>
      <p className="mt-1.5 text-[14px] text-gray-500 dark:text-zinc-400">Pick one goal. We&apos;ll show you when you&apos;ll get there.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {IDEAS.map((idea) => {
          const active = name === idea.label
          return (
            <button
              key={idea.label}
              type="button"
              onClick={() => {
                setName(idea.label)
                if (!target) setTarget(String(idea.target))
              }}
              className={`rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                active ? 'border-gray-900 bg-gray-900/5 text-gray-900 dark:border-white dark:bg-white/10 dark:text-white' : 'border-gray-200 bg-white text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
              }`}
            >
              {idea.emoji} {idea.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Or name your own" aria-label="Goal name" className={field} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">Target</span>
            <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="50000" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400">You can save a month</span>
            <input value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="5000" className={field} />
          </label>
        </div>
      </div>

      {forecast && forecast.months > 0 && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" /> Your forecast
          </p>
          <p className="mt-1.5 text-[17px] font-semibold leading-snug text-gray-900 dark:text-white">
            {name.trim() || 'Your goal'} by {format(forecast.date, 'MMMM yyyy')}
          </p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-zinc-300">
            {forecast.months} month{forecast.months === 1 ? '' : 's'} of saving {money(amountOf(monthly))}.
            {forecast.sooner && (
              <>
                {' '}
                Save {money(forecast.sooner.extra)} more a month and you&apos;re there {forecast.sooner.months} month{forecast.sooner.months === 1 ? '' : 's'} sooner, by{' '}
                {format(forecast.sooner.date, 'MMMM')}.
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onNext({ name: name.trim(), target: amountOf(target), monthly: amountOf(monthly), deadline: format(forecast!.date, 'yyyy-MM-dd') })}
          className="w-full rounded-2xl bg-gray-900 py-3.5 text-[15px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-gray-900"
        >
          Save this goal and continue
        </button>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-gray-200 py-3.5 text-[15px] font-semibold text-gray-600 transition-all hover:bg-gray-100 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            onClick={() => onNext(null)}
            className="flex-1 rounded-2xl py-3.5 text-[15px] font-semibold text-gray-500 transition-colors hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
