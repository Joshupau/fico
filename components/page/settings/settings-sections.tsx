'use client'

import { useMemo, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Eye, EyeOff, RotateCcw, Sparkles, Wallet } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import type { CurrencyCode, DateFormat, LandingPage } from '@/types/settings'

const currencyOptions: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'PHP', label: 'Philippine Peso', symbol: '₱' },
  { value: 'NGN', label: 'Nigerian Naira', symbol: '₦' },
  { value: 'GHS', label: 'Ghanaian Cedi', symbol: 'GH₵' },
  { value: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { value: 'ZAR', label: 'South African Rand', symbol: 'R' },
]

const landingPageOptions: { value: LandingPage; label: string; description: string }[] = [
  { value: '/dashboard', label: 'Dashboard', description: 'Open on the overview screen.' },
  { value: '/transactions', label: 'Transactions', description: 'Jump straight to the activity feed.' },
  { value: '/wallets', label: 'Wallets', description: 'Open your balances first.' },
  { value: '/bills', label: 'Bills', description: 'Start from upcoming bills and due dates.' },
  { value: '/budgets', label: 'Budgets', description: 'Focus on spending targets first.' },
]

const dateFormatOptions: { value: DateFormat; label: string }[] = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

function SettingCardShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-ios backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function formatCurrencyPreview(currency: CurrencyCode, hidden: boolean) {
  const meta = currencyOptions.find((option) => option.value === currency) ?? currencyOptions[0]
  return hidden ? '••••••' : `${meta.symbol}12,584.32`
}

function buildSettingsPayload(settings: ReturnType<typeof useSettingsStore.getState>) {
  return {
    currency: settings.currency,
    hideAmountsOnOpen: settings.hideAmountsOnOpen,
    compactLayout: settings.compactLayout,
    defaultLandingPage: settings.defaultLandingPage,
    dateFormat: settings.dateFormat,
  }
}

function SettingsHero() {
  const settings = useSettingsStore()
  const selectedCurrency = useMemo(
    () => currencyOptions.find((option) => option.value === settings.currency) ?? currencyOptions[0],
    [settings.currency]
  )
  const previewBalance = formatCurrencyPreview(settings.currency, settings.hideAmountsOnOpen)

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-secondary/40 p-6 shadow-ios">
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_55%)] lg:block" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary" className="gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
            <Sparkles className="size-3.5" />
            Offline ready
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Keep the app tuned to your preferences without any API dependency. Your choices are stored locally on this device and can be reused even when the site is offline.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-ios">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Primary currency</p>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
              <Wallet className="size-5 text-primary" />
              <span>{selectedCurrency.value}</span>
              <span className="text-sm text-muted-foreground">{selectedCurrency.symbol}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-ios">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Sample balance</p>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
              {settings.hideAmountsOnOpen ? <EyeOff className="size-5 text-muted-foreground" /> : <Eye className="size-5 text-primary" />}
              <span>{previewBalance}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MoneyDisplaySection() {
  const settings = useSettingsStore()

  return (
    <SettingCardShell
      title="Money display"
      description="Set the currency and choose whether balances stay hidden when the app opens."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Default currency</label>
          <Select value={settings.currency} onValueChange={(value) => settings.setCurrency(value as CurrencyCode)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.symbol} {option.label} ({option.value})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Hide amounts on open</p>
            <p className="text-sm text-muted-foreground">Balances start hidden until you choose to reveal them.</p>
          </div>
          <Button
            type="button"
            variant={settings.hideAmountsOnOpen ? 'default' : 'outline'}
            onClick={settings.toggleHideAmountsOnOpen}
            aria-pressed={settings.hideAmountsOnOpen}
            className="min-w-[160px]"
          >
            {settings.hideAmountsOnOpen ? 'Hidden by default' : 'Visible on open'}
          </Button>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
          This preference is persisted locally, so the same visibility behavior returns even after reloads or offline use.
        </div>
      </div>
    </SettingCardShell>
  )
}

function ConvenienceSection() {
  const settings = useSettingsStore()

  return (
    <SettingCardShell
      title="Convenience"
      description="Trim the interface and choose the screen you want to see first."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Default landing page</label>
          <Select value={settings.defaultLandingPage} onValueChange={(value) => settings.setDefaultLandingPage(value as LandingPage)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose landing page" />
            </SelectTrigger>
            <SelectContent>
              {landingPageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {landingPageOptions.find((option) => option.value === settings.defaultLandingPage)?.description}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Compact layout</p>
            <p className="text-sm text-muted-foreground">Reduce spacing so you can scan more content on smaller screens.</p>
          </div>
          <Button
            type="button"
            variant={settings.compactLayout ? 'default' : 'outline'}
            onClick={settings.toggleCompactLayout}
            aria-pressed={settings.compactLayout}
            className="min-w-[160px]"
          >
            {settings.compactLayout ? 'Compact on' : 'Compact off'}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Date format</label>
          <Select value={settings.dateFormat} onValueChange={(value) => settings.setDateFormat(value as DateFormat)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose date format" />
            </SelectTrigger>
            <SelectContent>
              {dateFormatOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SettingCardShell>
  )
}

function OfflineReadinessSection() {
  const settings = useSettingsStore()

  const handleDownloadBackup = () => {
    const payload = buildSettingsPayload(useSettingsStore.getState())
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'fico-settings-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SettingCardShell
      title="Offline readiness"
      description="Everything here is stored on the device so the app still feels personalized without network access."
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="font-medium text-foreground">Local persistence</p>
            <p className="mt-1">Settings are saved in browser storage and restored automatically.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="font-medium text-foreground">No API dependency</p>
            <p className="mt-1">The page works without backend calls, so it stays usable offline.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="font-medium text-foreground">Currency aware</p>
            <p className="mt-1">Formatting can be wired into wallet, budget, and transaction screens later.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="font-medium text-foreground">Balanced privacy</p>
            <p className="mt-1">Amount visibility can be hidden by default when the app opens.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleDownloadBackup} className="gap-2">
            <Download className="size-4" />
            Download local backup
          </Button>
          <Button type="button" variant="outline" onClick={() => settings.resetSettings()} className="gap-2">
            <RotateCcw className="size-4" />
            Reset to defaults
          </Button>
        </div>
      </div>
    </SettingCardShell>
  )
}

function RecommendedSettingsSection() {
  return (
    <SettingCardShell
      title="Recommended next settings"
      description="A short shortlist of useful options that fit the current app without requiring API work."
    >
      <ul className="space-y-3 text-sm text-muted-foreground">
        <li className="rounded-xl border border-border/70 bg-background/70 p-3">Add a default wallet filter so reports open exactly where the user left off.</li>
        <li className="rounded-xl border border-border/70 bg-background/70 p-3">Add a low-data or offline badge that explains when remote data is unavailable.</li>
        <li className="rounded-xl border border-border/70 bg-background/70 p-3">Add a backup/export page for local JSON settings and future data exports.</li>
        <li className="rounded-xl border border-border/70 bg-background/70 p-3">Add a language selector later if the app needs locale-aware formatting.</li>
      </ul>
    </SettingCardShell>
  )
}

export function SettingsPageContent() {
  const settings = useSettingsStore()

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <SettingsHero />

      <div className="grid gap-6 xl:grid-cols-2">
        <MoneyDisplaySection />
        <ConvenienceSection />
        {/* <OfflineReadinessSection /> */}
        {/* <RecommendedSettingsSection /> */}
      </div>

      {/* <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
        Current preview: {currencyOptions.find((option) => option.value === settings.currency)?.symbol} · {settings.defaultLandingPage} · {settings.dateFormat} · {settings.compactLayout ? 'compact' : 'comfortable'} · {settings.hideAmountsOnOpen ? 'amounts hidden on open' : 'amounts visible on open'}
      </div> */}
    </main>
  )
}
