'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCreateWallet, useUpdateWallet, useSetBalance } from '@/queries/user/wallet/wallets'
import { CreateWalletData, UpdateWalletData, WalletType } from '@/types/wallet'

interface CreateWalletModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  wallet?: {
    id: string
    name?: string
    type?: WalletType
    balance?: number
    color?: string
    icon?: string
    description?: string
    accountNumber?: string
  } | null
}

const initialFormData: CreateWalletData = {
  name: '',
  type: 'bank',
  balance: 0,
  currency: '$',
  color: '#0066CC',
  accountNumber: '',
  description: '',
}

const walletTypes: Array<{ value: WalletType; label: string }> = [
  { value: 'bank', label: 'Bank Account' },
  { value: 'cash', label: 'Cash' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
]

export function CreateWalletModal({ open, onClose, onSuccess, wallet }: CreateWalletModalProps) {
  const [formData, setFormData] = useState<CreateWalletData>(initialFormData)
  const { mutate: createWallet, isPending } = useCreateWallet()
  const { mutate: updateWallet, isPending: isUpdating } = useUpdateWallet()
  const { mutate: setBalance, isPending: isOverriding } = useSetBalance()
  const isEdit = !!wallet

  useEffect(() => {
    if (!open) return

    if (wallet) {
      setFormData({
        name: wallet.name || '',
        type: wallet.type || 'bank',
        balance: wallet.balance,
        currency: undefined,
        color: wallet.color || '#0066CC',
        icon: wallet.icon || '',
        description: wallet.description || '',
        accountNumber: wallet.accountNumber || '',
      })
      return
    }

    setFormData(initialFormData)
  }, [open, wallet])

  const handleFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target

    if (name === 'balance') {
      setFormData((previous) => ({
        ...previous,
        balance: value === '' ? undefined : Number(value),
      }))
      return
    }

    if (name === 'type') {
      setFormData((previous) => ({
        ...previous,
        type: value as WalletType,
      }))
      return
    }

    if (
      name === 'name' ||
      name === 'currency' ||
      name === 'icon' ||
      name === 'color' ||
      name === 'description' ||
      name === 'accountNumber'
    ) {
      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }))
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Wallet name is required')
      return
    }

    if (isEdit && wallet) {
      const updateData: UpdateWalletData = {
        id: wallet.id,
        name: formData.name,
        type: formData.type,
        color: formData.color,
        icon: formData.icon,
        description: formData.description,
        accountNumber: formData.accountNumber,
      }

      const balanceChanged = formData.balance !== undefined && formData.balance !== wallet.balance

      updateWallet(updateData, {
        onSuccess: () => {
          if (!balanceChanged) {
            toast.success('Wallet updated successfully!')
            onClose()
            onSuccess?.()
            return
          }

          setBalance(
            { id: wallet.id, balance: formData.balance as number },
            {
              onSuccess: () => {
                toast.success('Wallet updated and balance overridden!')
                onClose()
                onSuccess?.()
              },
            }
          )
        },
      })
      return
    }

    createWallet(formData, {
      onSuccess: () => {
        toast.success('Wallet created successfully!')
        setFormData(initialFormData)
        onClose()
        onSuccess?.()
      },
    })
  }

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Wallet' : 'Create New Wallet'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Update the wallet details that can be edited here.' : 'Create a wallet for cash, bank, or cards.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-2">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Wallet Name *
            </label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleFieldChange}
              placeholder="Main Wallet"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="type" className="block text-sm font-medium text-foreground">
              Type *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleFieldChange}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {walletTypes.map((walletType) => (
                <option key={walletType.value} value={walletType.value}>
                  {walletType.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="balance" className="block text-sm font-medium text-foreground">
                {isEdit ? 'Balance (override)' : 'Initial Balance'}
              </label>
              <Input
                id="balance"
                type="number"
                name="balance"
                step="0.01"
                value={formData.balance ?? ''}
                onChange={handleFieldChange}
                placeholder="0.00"
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Directly sets the balance. Transactions no longer adjust it automatically after import — use this to reconcile.
                </p>
              )}
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <label htmlFor="currency" className="block text-sm font-medium text-foreground">
                  Currency
                </label>
                <Input
                  id="currency"
                  name="currency"
                  value={formData.currency ?? ''}
                  onChange={handleFieldChange}
                  placeholder="$"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="color" className="block text-sm font-medium text-foreground">
                Color
              </label>
              <Input
                id="color"
                type="color"
                name="color"
                value={formData.color ?? '#0066CC'}
                onChange={handleFieldChange}
                className="h-10 p-1"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="icon" className="block text-sm font-medium text-foreground">
                Icon (optional)
              </label>
              <Input
                id="icon"
                name="icon"
                value={formData.icon ?? ''}
                onChange={handleFieldChange}
                placeholder="wallet"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="accountNumber" className="block text-sm font-medium text-foreground">
              Account Number
            </label>
            <Input
              id="accountNumber"
              name="accountNumber"
              value={formData.accountNumber ?? ''}
              onChange={handleFieldChange}
              placeholder="1234567890"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description ?? ''}
              onChange={handleFieldChange}
              placeholder="Personal spending wallet"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <SheetFooter className="px-0 pt-2 border-t-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending || isUpdating || isOverriding}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isUpdating || isOverriding}>
              {isPending || isUpdating || isOverriding ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Wallet'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}