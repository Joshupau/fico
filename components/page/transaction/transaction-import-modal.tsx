import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useImportTransactions } from '@/queries/user/transaction/transaction';
import { useListWallets } from '@/queries/user/wallet/wallets';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { checkStatement, type ReconcileCheck } from '@/utils/import-reconcile';
import type { Fix } from '@/utils/ledgerlens';
import { ImportReview, type Decisions } from './import-review';

interface TransactionImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransactionImportModal({ open, onClose, onSuccess }: TransactionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletId, setWalletId] = useState<string>('');
  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [check, setCheck] = useState<ReconcileCheck | null | 'unreadable'>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const { mutate, isSuccess, isError, error, reset } = useImportTransactions();
  const { data: walletsData } = useListWallets();

  const wallets: any[] = Array.isArray(walletsData?.data?.items) ? walletsData.data.items : [];
  const wallet = wallets.find((w) => (w._id || w.id) === walletId);
  const currency: string = wallet?.currency || 'PHP';
  const isCsv = !!file && /\.csv$/i.test(file.name);

  const clear = () => {
    setFile(null);
    setWalletId('');
    setOpening('');
    setClosing('');
    setCheck(null);
    setDecisions({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCheck(null);
    setDecisions({});
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Runs the arithmetic check on the device. It never changes the file or the rows.
  const handleCheck = async () => {
    if (!file) return;
    const result = checkStatement(await file.text(), currency, { opening, closing });
    setCheck(result ?? 'unreadable');
    setDecisions({});
  };

  const acceptedFixes: Fix[] = Object.values(decisions).filter((d): d is Fix => !!d);
  const findings = check && check !== 'unreadable' ? check.report.findings.length : 0;
  const undecided = check && check !== 'unreadable' ? check.report.findings.filter((_, i) => decisions[i] === undefined).length : 0;

  const handleImport = () => {
    if (!file || !walletId) return;
    setLoading(true);
    mutate({ file, walletId, preview: false, fixes: acceptedFixes, currency }, {
      onSuccess: () => {
        setLoading(false);
        clear();
        if (onSuccess) onSuccess();
        onClose();
      },
      onError: () => {
        setLoading(false);
      },
    });
  };

  const importLabel = loading ? 'Importing...' : acceptedFixes.length ? `Import with ${acceptedFixes.length} fix${acceptedFixes.length === 1 ? '' : 'es'}` : 'Import';

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) { reset(); onClose(); } }}>
      <SheetContent className="sm:max-w-md" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Import Transactions</SheetTitle>
          <SheetDescription>Upload a CSV or XLSX export into one of your wallets.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 min-h-0">
          <div className="space-y-2">
            <label htmlFor="walletId" className="text-sm font-semibold text-foreground block">
              Wallet <span className="text-destructive">*</span>
            </label>
            <select
              id="walletId"
              name="walletId"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="">Select a wallet</option>
              {wallets.map((wallet: any) => (
                <option key={wallet._id || wallet.id} value={wallet._id || wallet.id}>
                  {wallet.name} ({wallet.currency || 'USD'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="importFile" className="text-sm font-semibold text-foreground block">
              File <span className="text-destructive">*</span>
            </label>
            <Input id="importFile" type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
          </div>

          {isCsv && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-sm font-semibold text-foreground">Check it against the statement</p>
              <p className="text-xs text-muted-foreground">
                Fico adds the rows up before saving them. If the file has no balance column, type the opening and closing balance printed on the statement.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input inputMode="decimal" placeholder="Opening balance" aria-label="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} />
                <Input inputMode="decimal" placeholder="Closing balance" aria-label="Closing balance" value={closing} onChange={(e) => setClosing(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={handleCheck} disabled={!file}>
                {check ? 'Check again' : 'Check statement'}
              </Button>
              {check === 'unreadable' && (
                <p className="text-xs text-muted-foreground">This file could not be read as a statement, so it will be imported without a check.</p>
              )}
              {check && check !== 'unreadable' && (
                <ImportReview
                  check={check}
                  currency={currency}
                  decisions={decisions}
                  onDecide={(i, fix) => setDecisions((d) => ({ ...d, [i]: fix }))}
                />
              )}
            </div>
          )}

          {isError && <p className="text-sm text-destructive">{error?.message || 'Import failed.'}</p>}
          {isSuccess && <p className="text-sm text-success">Import successful!</p>}
        </div>

        <SheetFooter className="pt-2">
          <Button variant="outline" onClick={() => { reset(); clear(); onClose(); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || !walletId || loading} title={undecided ? `${undecided} of ${findings} findings not decided yet` : undefined}>
            {importLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
