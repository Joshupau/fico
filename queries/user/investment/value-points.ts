// Every recorded value of every investment (table investment_value_snapshots): value updates, sales
// and the server's daily crypto prices. A plain table read, so it works offline.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase-client'
import type { ValuePoint } from '@/utils/portfolio'

const enabledBackend = () => process.env.NEXT_PUBLIC_BACKEND === 'supabase'

async function listValuePoints(): Promise<ValuePoint[]> {
  if (!enabledBackend()) return []
  const { data, error } = await supabase
    .from('investment_value_snapshots')
    .select('investment_id, value, snapshot_date')
    .order('snapshot_date', { ascending: true })
  if (error) throw error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({ investmentId: String(r.investment_id), date: String(r.snapshot_date), value: Number(r.value) }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export const useInvestmentValuePoints = () =>
  useQuery({ queryKey: ['investment-value-points'], queryFn: listValuePoints, staleTime: 5 * 60_000, retry: false })
