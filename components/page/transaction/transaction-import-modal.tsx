import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useImportTransactions } from '@/queries/user/transaction/transaction';
import { useListWallets } from '@/queries/user/wallet/wallets';
import { csvHeaders, type ColumnMapping } from '@/utils/import-csv';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';

interface TransactionImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Preview {
  totalRows: number;
  format: 'csv' | 'ofx' | 'qif';
  willImport: number;
  duplicates: number;
  willSkip: number;
}

const MAP_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount (minus for spending)' },
  { key: 'description', label: 'Description' },
];

const selectClass =
  'w-full px-3 py-2 border border-border rounded-xl bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all';

export function TransactionImportModal({ open, onClose, onSuccess }: TransactionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletId, setWalletId] = useState<string>('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const { mutate, isSuccess, isError, error, reset } = useImportTransactions();
  const previewer = useImportTransactions();
  const { data: walletsData } = useListWallets();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const picked = e.target.files[0];
      setFile(picked);
      setMapping({});
      picked.text().then((text) => setHeaders(csvHeaders(text))).catch(() => setHeaders([]));
    }
  };

  // Count what would be imported, already there, or skipped, before anything is written.
  const runPreview = previewer.mutate;
  useEffect(() => {
    if (!file || !walletId) return;
    runPreview(
      { file, walletId, preview: true, mapping },
      { onSuccess: (res: { data?: Preview }) => setPreview(res?.data ?? null), onError: () => setPreview(null) }
    );
  }, [file, walletId, mapping, runPreview]);

  const handleImport = () => {
    if (!file || !walletId) return;
    setLoading(true);
    mutate({ file, walletId, preview: false, mapping }, {
      onSuccess: () => {
        setLoading(false);
        setFile(null);
        setWalletId('');
        setPreview(null);
        if (onSuccess) onSuccess();
        onClose();
      },
      onError: () => {
        setLoading(false);
      },
    });
  };

  const needsMapping = preview?.format === 'csv' && preview.totalRows > 0 && preview.willImport === 0 && preview.duplicates === 0;
  const showMapping = headers.length > 0 && (needsMapping || Object.values(mapping).some(Boolean));

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) { reset(); onClose(); } }}>
      <SheetContent className="sm:max-w-md" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>Import Transactions</SheetTitle>
          <SheetDescription>A bank statement (CSV, OFX, QFX or QIF), or an export from Firefly III or Actual Budget.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 min-h-0">
          <div className="space-y-2">
            <label htmlFor="walletId" className="text-sm font-semibold text-foreground block">
              Wallet <span className="text-destructive">*</span>
            </label>
            <select id="walletId" name="walletId" value={walletId} onChange={(e) => setWalletId(e.target.value)} className={selectClass}>
              <option value="">Select a wallet</option>
              {walletsData?.data && Array.isArray(walletsData.data.items) && walletsData.data.items.map((wallet: any) => (
                <option key={wallet._id || wallet.id} value={wallet._id || wallet.id}>
                  {wallet.name} ({wallet.currency || 'USD'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              File <span className="text-destructive">*</span>
            </label>
            <Input type="file" accept=".csv,.ofx,.qfx,.qif,.txt" onChange={handleFileChange} />
          </div>

          {showMapping && (
            <div className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-sm text-foreground">Fico didn&apos;t recognise this file&apos;s columns. Which one holds each of these?</p>
              {MAP_FIELDS.map((f) => (
                <label key={f.key} className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                  <select value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))} className={selectClass}>
                    <option value="">Choose a column</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          {preview && !needsMapping && (
            <p className="rounded-2xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
              <span className="font-semibold">{preview.willImport}</span> new
              {preview.duplicates > 0 && <> · {preview.duplicates} already in this wallet</>}
              {preview.willSkip > 0 && <> · {preview.willSkip} skipped</>}
            </p>
          )}

          {isError && <p className="text-sm text-destructive">{error?.message || 'Import failed.'}</p>}
          {isSuccess && <p className="text-sm text-success">Import successful!</p>}
        </div>

        <SheetFooter className="pt-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || !walletId || loading || (preview !== null && preview.willImport === 0)}>
            {loading ? 'Importing...' : preview ? `Import ${preview.willImport}` : 'Import'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
