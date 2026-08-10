'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useCreateTransaction, useUpdateTransaction } from '@/queries/user/transaction/transaction'
import { useListWallets } from '@/queries/user/wallet/wallets'
import { useListCategories } from '@/queries/user/category/categories'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'
import { CreateTransactionData, UpdateTransactionData } from '@/types/transaction'

interface WalletItem {
  _id?: string
  id?: string
  name?: string
  balance?: number | string
  currentBalance?: number | string
  currency?: string
}

interface CreateTransactionModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  initialWalletId?: string
  initialType?: 'income' | 'expense' | 'transfer'
  title?: string
  initialData?: Partial<CreateTransactionData>
  transaction?: ({ id: string } & Partial<UpdateTransactionData> & Partial<CreateTransactionData>) | null
}

const getWalletId = (wallet: WalletItem, index: number) => wallet._id ?? wallet.id ?? `wallet-${index}`

const formatWalletAmount = (wallet: WalletItem) => {
  const rawBalance = wallet.balance ?? wallet.currentBalance ?? 0
  const numericBalance = Number(rawBalance)
  const { currency: settingsCurrency, hideAmountsOnOpen } = useSettingsStore.getState()
  const currency = wallet.currency || settingsCurrency

  if (!Number.isFinite(numericBalance)) {
    return formatMoney(0, currency, hideAmountsOnOpen)
  }

  return formatMoney(numericBalance, currency, hideAmountsOnOpen)
}

function TransactionFormBody({
  formData,
  setFormData,
  includeServiceFee,
  setIncludeServiceFee,
  serviceFee,
  setServiceFee,
  wallets,
  categories,
  currency,
  hideAmountsOnOpen,
  onClose,
  handleSubmit,
  isPending,
  isUpdating,
  isEdit,
  title,
}: {
  formData: Partial<CreateTransactionData>
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateTransactionData>>>
  includeServiceFee: boolean
  setIncludeServiceFee: React.Dispatch<React.SetStateAction<boolean>>
  serviceFee: number
  setServiceFee: React.Dispatch<React.SetStateAction<number>>
  wallets: WalletItem[]
  categories: any[]
  currency: string
  hideAmountsOnOpen: boolean
  onClose: () => void
  handleSubmit: (e: React.FormEvent) => void
  isPending: boolean
  isUpdating: boolean
  isEdit: boolean
  title: string
}) {
  const getWalletCurrency = (wallet: WalletItem) => wallet.currency || currency
  const destinationWallets = useMemo(
    () => wallets.filter((wallet, index) => getWalletId(wallet, index) !== formData.walletId),
    [wallets, formData.walletId]
  )

  const selectWallet = (walletId: string) => {
    setFormData((previous) => ({
      ...previous,
      walletId,
      ...(previous.type === 'transfer' && previous.toWalletId === walletId ? { toWalletId: '' } : {}),
    }))
  }

  const formatSelectedWalletAmount = (wallet: WalletItem) => {
    const rawBalance = wallet.balance ?? wallet.currentBalance ?? 0
    const numericBalance = Number(rawBalance)

    if (!Number.isFinite(numericBalance)) {
      return formatMoney(0, getWalletCurrency(wallet), hideAmountsOnOpen)
    }

    return formatMoney(numericBalance, getWalletCurrency(wallet), hideAmountsOnOpen)
  }

  return (
    <>
      <div className="flex items-center justify-between p-6 border-b border-border">
        <SheetTitle className="text-lg font-semibold text-foreground">{isEdit ? 'Edit Transaction' : title}</SheetTitle>
        <SheetDescription className="sr-only">
          {isEdit ? 'Update the details for this transaction.' : 'Fill out the form to record a new transaction.'}
        </SheetDescription>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 space-y-4 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <label className="text-sm font-medium text-foreground block">Wallet *</label>
            <div className="overflow-x-auto rounded-lg border border-border bg-input/40 p-2">
              {wallets.length > 0 ? (
                <div className="grid grid-flow-col grid-rows-2 auto-cols-[11rem] gap-2 min-w-max">
                  {wallets.map((wallet, index) => {
                    const walletId = getWalletId(wallet, index)
                    const isSelected = formData.walletId === walletId

                    return (
                      <button
                        key={walletId}
                        type="button"
                        onClick={() => selectWallet(walletId)}
                        className={`w-40 sm:w-44 rounded-lg border px-3 py-2 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-background hover:border-primary/50 hover:bg-secondary/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{wallet.name || 'Untitled Wallet'}</p>
                            <p className="truncate text-xs text-muted-foreground">{getWalletCurrency(wallet)} wallet</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{formatSelectedWalletAmount(wallet)}</p>
                            <p className="text-[11px] text-muted-foreground">{isSelected ? 'Selected' : 'Tap to choose'}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">No wallets available</p>
              )}
            </div>
          </div>

          <div className="space-y-2 col-span-2 sm:col-span-1">
            <label htmlFor="type" className="text-sm font-medium text-foreground block">Type *</label>
            <select
              id="type"
              name="type"
              value={formData.type || 'expense'}
              onChange={(event) => setFormData((previous) => ({ ...previous, type: event.target.value as 'income' | 'expense' | 'transfer' }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>

        <div className={`grid gap-3 ${formData.type === 'transfer' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {formData.type !== 'transfer' && (
            <div className="space-y-2">
              <label htmlFor="categoryId" className="text-sm font-medium text-foreground block">Category</label>
              <select
                id="categoryId"
                name="categoryId"
                value={formData.categoryId || ''}
                onChange={(event) => setFormData((previous) => ({ ...previous, categoryId: event.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
              >
                <option value="">Select a category</option>
                {categories.map((category: any) => (
                  <option key={category._id || category.id} value={category._id || category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium text-foreground block">Amount *</label>
            <Input
              id="amount"
              type="number"
              name="amount"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={formData.amount || ''}
              onChange={(event) =>
                setFormData((previous) => ({ ...previous, amount: event.target.value === '' ? undefined : Number(event.target.value) }))
              }
              className="w-full text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="date" className="text-sm font-medium text-foreground block">Date</label>
            <Input
              id="date"
              type="date"
              name="date"
              value={formData.date || ''}
              onChange={(event) => setFormData((previous) => ({ ...previous, date: event.target.value }))}
              className="w-full text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Service Fee</label>
            <input
              type="checkbox"
              id="includeServiceFee"
              checked={includeServiceFee}
              onChange={(event) => setIncludeServiceFee(event.target.checked)}
              className="w-4 h-4 rounded border border-border bg-input cursor-pointer accent-primary mt-2"
            />
          </div>
        </div>

        {includeServiceFee && (
          <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="serviceFee" className="text-xs font-medium text-foreground block mb-1">Fee Amount</label>
                <Input
                  id="serviceFee"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={serviceFee || ''}
                  onChange={(event) => setServiceFee(parseFloat(event.target.value) || 0)}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Total</p>
                <div className="px-3 py-2 rounded-lg bg-background border border-border text-sm font-semibold text-foreground">
                  {((formData.amount || 0) + serviceFee).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {formData.type === 'transfer' && (
          <div className="space-y-2">
            <label htmlFor="toWalletId" className="text-sm font-medium text-foreground block">Transfer to *</label>
            <div className="overflow-x-auto rounded-lg border border-border bg-input/40 p-2">
              {destinationWallets.length > 0 ? (
                <div className="grid grid-flow-col grid-rows-2 auto-cols-[11rem] gap-2 min-w-max">
                  {destinationWallets.map((wallet, index) => {
                    const walletId = getWalletId(wallet, index)
                    const isSelected = formData.toWalletId === walletId

                    return (
                      <button
                        key={walletId}
                        type="button"
                        onClick={() => setFormData((previous) => ({ ...previous, toWalletId: walletId }))}
                        className={`w-40 sm:w-44 rounded-lg border px-3 py-2 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-background hover:border-primary/50 hover:bg-secondary/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{wallet.name || 'Untitled Wallet'}</p>
                            <p className="truncate text-xs text-muted-foreground">{getWalletCurrency(wallet)} wallet</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{formatSelectedWalletAmount(wallet)}</p>
                            <p className="text-[11px] text-muted-foreground">{isSelected ? 'Selected' : 'Tap to choose'}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">No destination wallets available</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-foreground block">Description *</label>
          <Input
            id="description"
            name="description"
            placeholder="Enter transaction details..."
            value={formData.description || ''}
            onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
            className="w-full text-sm"
          />
        </div>
      </form>

      <div className="shrink-0 border-t border-border p-6 flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending || isUpdating}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || isUpdating} className="gap-2" onClick={handleSubmit}>
          {isPending || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
        </Button>
      </div>
    </>
  )
}

export function CreateTransactionModal({
  open,
  onClose,
  onSuccess,
  initialWalletId,
  initialType = 'expense',
  title = 'New Transaction',
  initialData,
  transaction,
}: CreateTransactionModalProps) {
  const isEdit = !!transaction
  const [formData, setFormData] = useState<Partial<CreateTransactionData>>({
    type: transaction?.type ?? initialData?.type ?? initialType,
    walletId: transaction?.walletId ?? initialData?.walletId ?? initialWalletId,
    amount: transaction?.amount ?? initialData?.amount ?? 0,
    description: transaction?.description ?? initialData?.description ?? '',
    categoryId: transaction?.categoryId ?? initialData?.categoryId,
    date: transaction?.date ?? initialData?.date,
    toWalletId: transaction?.toWalletId ?? initialData?.toWalletId,
  })
  const [includeServiceFee, setIncludeServiceFee] = useState((transaction?.serviceFee ?? initialData?.serviceFee ?? 0) > 0)
  const [serviceFee, setServiceFee] = useState(transaction?.serviceFee ?? initialData?.serviceFee ?? 0)

  useEffect(() => {
    if (!open) return

    setFormData({
      type: transaction?.type ?? initialData?.type ?? initialType,
      walletId: transaction?.walletId ?? initialData?.walletId ?? initialWalletId,
      amount: transaction?.amount ?? initialData?.amount ?? 0,
      description: transaction?.description ?? initialData?.description ?? '',
      categoryId: transaction?.categoryId ?? initialData?.categoryId,
      date: transaction?.date ?? initialData?.date,
      toWalletId: transaction?.toWalletId ?? initialData?.toWalletId,
    })

    const fee = transaction?.serviceFee ?? initialData?.serviceFee ?? 0
    setIncludeServiceFee(fee > 0)
    setServiceFee(fee)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  const { mutate: createTransaction, isPending } = useCreateTransaction()
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
  const { data: walletsResponse } = useListWallets()
  const { data: categoriesResponse } = useListCategories()
  const { currency } = useSettingsStore()

  const wallets = walletsResponse?.data ? (Array.isArray(walletsResponse.data) ? walletsResponse.data : walletsResponse.data.items || []) : []
  const categories = categoriesResponse?.data ? (Array.isArray(categoriesResponse.data) ? categoriesResponse.data : categoriesResponse.data.items || []) : []

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.walletId) {
      toast.error('Please select a wallet')
      return
    }
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!formData.description?.trim()) {
      toast.error('Please enter a description')
      return
    }

    const submissionData = {
      ...formData,
      ...(includeServiceFee && serviceFee > 0 && { serviceFee }),
    } as CreateTransactionData

    if (isEdit && transaction) {
      const updateData: UpdateTransactionData = {
        id: transaction.id,
        walletId: submissionData.walletId,
        categoryId: submissionData.categoryId,
        amount: submissionData.amount,
        type: submissionData.type,
        description: submissionData.description,
        date: submissionData.date,
        tags: transaction.tags,
        attachments: transaction.attachments,
        status: transaction.status,
      }

      updateTransaction(updateData, {
        onSuccess: () => {
          toast.success('Transaction updated successfully!')
          onClose()
          onSuccess?.()
        },
        onError: (error) => {
          console.error('Error updating transaction:', error)
        },
      })
      return
    }

    createTransaction(submissionData, {
      onSuccess: () => {
        toast.success('Transaction created successfully!')
        setFormData({
          type: 'expense',
          amount: 0,
          description: '',
        })
        setIncludeServiceFee(false)
        setServiceFee(0)
        onClose()
        onSuccess?.()
      },
      onError: (error) => {
        console.error('Error creating transaction:', error)
      },
    })
  }

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card md:rounded-2xl md:border md:border-border md:shadow-ios-lg">
          <TransactionFormBody
            formData={formData}
            setFormData={setFormData}
            includeServiceFee={includeServiceFee}
            setIncludeServiceFee={setIncludeServiceFee}
            serviceFee={serviceFee}
            setServiceFee={setServiceFee}
            wallets={wallets}
            categories={categories}
            currency={currency}
            hideAmountsOnOpen={false}
            onClose={onClose}
            handleSubmit={handleSubmit}
            isPending={isPending}
            isUpdating={isUpdating}
            isEdit={isEdit}
            title={title}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
