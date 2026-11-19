import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { canRequestLedgerSummary, requestLedgerSummary } from '@/utils/ledgerSummaryAccess';
import type { summarizeCustomers } from '@/utils/ledgerSalespersons';

type Summary = ReturnType<typeof summarizeCustomers>;

export function useLedgerSummary(customerIds: string[], recordsLoading: boolean) {
  const { user, profile, loading } = useAuth();
  const identity = { userId: user?.id, profileUserId: profile?.user_id, role: profile?.role, active: profile?.is_active, loading };
  const allowed = canRequestLedgerSummary(identity);
  const idsKey = JSON.stringify(customerIds);
  const key = JSON.stringify([user?.id, idsKey]);
  const [result, setResult] = useState<{ key: string; summary: Summary } | null>(null);

  useEffect(() => {
    setResult(null);
    if (!allowed || recordsLoading) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void requestLedgerSummary(identity, async () => {
        const { data, error } = await supabase.rpc('admin_customer_ledger_summary', { customer_ids: JSON.parse(idsKey) });
        if (!cancelled && !error && data) setResult({ key, summary: data as Summary });
      });
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [allowed, recordsLoading, idsKey, key]);

  return { allowed, summary: allowed && !recordsLoading && result?.key === key ? result.summary : null };
}