'use client'

import { useState } from 'react'
import BudgetList from '@/components/budgets/budget-list'
import { IonPage, IonContent } from '@ionic/react'
import { BudgetsHeader } from '@/components/page/budget/budgets-header'
import BudgetModal from '@/components/budgets/budget-modal'
import { startOfMonth } from '@/utils/budget-month'
import { PlansSection } from '@/components/page/budget/plans/plans-section'
import { useBudgetMonth } from '@/hooks/use-budget-month'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'


export default function BudgetsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const budgetMonth = useBudgetMonth(month)
  // Budgets live inside plans. Until the plans update reaches the account, the page is just budgets.
  const plansOn = !budgetMonth.plansUnavailable
  const [newPlanRequest, setNewPlanRequest] = useState(0)
  const { currency, hideAmountsOnOpen } = useSettingsStore()
  // One line of totals for the month; the full breakdown is on Statistics.
  const spent = budgetMonth.planStatuses.reduce((sum, p) => sum + p.spent, 0)
  const target = budgetMonth.planStatuses.reduce((sum, p) => sum + p.spendTarget, 0)
  const headerSummary =
    plansOn && target > 0
      ? `${formatMoney(spent, currency, hideAmountsOnOpen)} spent of ${formatMoney(target, currency, hideAmountsOnOpen)}`
      : undefined
  
  return (
    <IonPage>
      <IonContent className="bg-background text-foreground transition-all duration-300">
        <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <BudgetsHeader 
            onAddBudget={() => (plansOn ? setNewPlanRequest((n) => n + 1) : setIsModalOpen(true))}
            addLabel={plansOn ? 'New plan' : undefined}
            summary={headerSummary}
            loading={budgetMonth.loading}
            month={month}
            onMonthChange={setMonth}
          />
          
          {plansOn ? <PlansSection data={budgetMonth} month={month} newPlanRequest={newPlanRequest} /> : <BudgetList month={month} />}
          
          <BudgetModal 
            open={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
          />
        </main>
      </IonContent>
    </IonPage>
  )
}

