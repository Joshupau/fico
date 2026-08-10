'use client'

import * as React from 'react'
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  EventProps,
  View,
} from 'react-big-calendar'
import { ChevronLeft, ChevronRight, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { useBillCalendar } from '@/queries/user/bill/bills'
import {
  endOfMonth,
  format,
  getDay,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

type BillApiItem = {
  _id?: string
  id?: string
  name?: string
  amount?: number
  status?: string
  paymentStatus?: string
  notes?: string
}

type BillCalendarEvent = {
  title: string
  start: Date
  end: Date
  allDay: boolean
  resource: {
    id: string
    amount: number
    status: string
    notes?: string
    date: string
  }
}

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

function BillEvent({ event }: EventProps<BillCalendarEvent>) {
  const { currency } = useSettingsStore()
  const isPaid = event.resource.status === 'paid'
  const isOverdue = !isPaid && new Date(event.resource.date) < new Date()
  
  let statusClass = 'bill-badge-upcoming'
  if (isPaid) statusClass = 'bill-badge-paid'
  else if (isOverdue) statusClass = 'bill-badge-overdue'

  return (
    <div className="bill-event group">
      <div className={`bill-badge ${statusClass}`}>
        {isPaid ? (
          <CheckCircle2 className="w-2.5 h-2.5" />
        ) : isOverdue ? (
          <AlertCircle className="w-2.5 h-2.5" />
        ) : (
          <CreditCard className="w-2.5 h-2.5" />
        )}
        <span className="bill-badge-amount">{formatMoney(event.resource.amount, currency, false)}</span>
      </div>

      <div className="bill-event-hovercard" role="tooltip">
        <p className="bill-hover-title">{event.title}</p>
        <div className="bill-hover-grid">
          <span className="bill-hover-label">Amount</span>
          <span className="bill-hover-value">{formatMoney(event.resource.amount, currency, false)}</span>
          <span className="bill-hover-label">Status</span>
          <span className={`bill-hover-value ${isPaid ? 'bill-hover-paid' : 'bill-hover-unpaid'}`}>
            {event.resource.status}
          </span>
          <span className="bill-hover-label">Due</span>
          <span className="bill-hover-value">{event.resource.date}</span>
        </div>
        {event.resource.notes ? <p className="bill-hover-notes">{event.resource.notes}</p> : null}
      </div>
    </div>
  )
}

type ToolbarProps = {
  label: string
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void
}

function BillCalendarToolbar({ label, onNavigate }: ToolbarProps) {
  return (
    <div className="bill-toolbar">
      <div className="bill-toolbar-left">
        <h4 className="bill-toolbar-label">{label}</h4>
      </div>
      <div className="bill-toolbar-actions">
        <button type="button" className="bill-toolbar-btn" onClick={() => onNavigate('TODAY')}>
          Today
        </button>
        <button
          type="button"
          aria-label="Previous month"
          className="bill-toolbar-btn bill-toolbar-icon-btn"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          className="bill-toolbar-btn bill-toolbar-icon-btn"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function BillCalendarCard() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [view] = React.useState<View>('month')

  const { data: calendarResponse, isLoading } = useBillCalendar({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
  })

  const events = React.useMemo<BillCalendarEvent[]>(() => {
    const calendarEvents = calendarResponse?.data?.calendarEvents
    if (!calendarEvents || typeof calendarEvents !== 'object') return []

    return Object.entries(calendarEvents).flatMap(([dateKey, bills]) => {
      if (!Array.isArray(bills)) return []

      return bills.map((billItem, index) => {
        const bill = (billItem || {}) as BillApiItem
        const billDate = parseISO(dateKey)
        const status = String(bill.paymentStatus || bill.status || 'unpaid').toLowerCase()
        const amount = Number(bill.amount || 0)
        const id = bill._id || bill.id || `${dateKey}-${index}`
        const title = bill.name || 'Unnamed Bill'

        return {
          title,
          start: billDate,
          end: billDate,
          allDay: true,
          resource: {
            id,
            amount,
            status,
            notes: bill.notes,
            date: dateKey,
          },
        }
      })
    })
  }, [calendarResponse])

  const eventPropGetter = React.useCallback((event: BillCalendarEvent) => {
    return {
      className: 'bill-event-shell',
    }
  }, [])

  const tooltipAccessor = React.useCallback((event: BillCalendarEvent) => {
    const { currency, hideAmountsOnOpen } = useSettingsStore.getState()
    const parts = [
      event.title,
      `Amount: ${formatMoney(event.resource.amount, currency, hideAmountsOnOpen)}`,
      `Status: ${event.resource.status}`,
      `Due: ${event.resource.date}`,
    ]

    if (event.resource.notes) {
      parts.push(`Notes: ${event.resource.notes}`)
    }

    return parts.join(' | ')
  }, [])

  const handleNavigate = React.useCallback((nextDate: Date) => {
    setCurrentMonth(nextDate)
  }, [])

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-ios flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-foreground">Bill Calendar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Upcoming obligations</p>
        </div>
        {isLoading && (
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      <div className="bill-calendar-wrap w-full h-full min-h-0">
        <BigCalendar
          localizer={localizer}
          events={events}
          date={currentMonth}
          view={view}
          views={['month']}
          toolbar
          popup
          onNavigate={handleNavigate}
          startAccessor="start"
          endAccessor="end"
          tooltipAccessor={tooltipAccessor}
          eventPropGetter={eventPropGetter}
          components={{
            event: BillEvent,
            toolbar: BillCalendarToolbar,
          }}
        />
      </div>
    </div>
  )
}
