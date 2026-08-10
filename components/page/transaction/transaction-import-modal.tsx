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

interface TransactionImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransactionImportModal({ open, onClose, onSuccess }: TransactionImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletId, setWalletId] = useState<string>('');
  const { mutate, isSuccess, isError, error, reset } = useImportTransactions();
  const { data: walletsData } = useListWallets();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file || !walletId) return;
    setLoading(true);
    mutate({ file, walletId, preview: false }, {
      onSuccess: () => {
        setLoading(false);
        setFile(null);
        setWalletId('');
        if (onSuccess) onSuccess();
        onClose();
      },
      onError: () => {
        setLoading(false);
      },
    });
  };

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
            <Input type="file" accept=".csv,.xlsx" onChange={handleFileChange} />
          </div>

          {isError && <p className="text-sm text-destructive">{error?.message || 'Import failed.'}</p>}
          {isSuccess && <p className="text-sm text-success">Import successful!</p>}
        </div>

        <SheetFooter className="pt-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || !walletId || loading}>
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
