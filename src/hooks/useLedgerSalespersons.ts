import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { fetchLedgerPages } from '@/utils/fetchLedgerPages';
import type { LedgerSalesperson } from '@/utils/ledgerSalespersons';

export function useLedgerSalespersons() {
  const [salespersons, setSalespersons] = useState<LedgerSalesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchLedgerPages('ledger_salespersons');
    if (error) toast({ title: 'Unable to load salespersons', description: error.message, variant: 'destructive' });
    else setSalespersons((data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, []);
  useEffect(() => { void refetch(); }, [refetch]);

  const saveSalesperson = async (name: string, id?: string) => {
    const payload = { name: name.trim() };
    const query = id ? supabase.from('ledger_salespersons').update(payload).eq('id', id) : supabase.from('ledger_salespersons').insert(payload);
    const { error } = await query.select('id').single();
    if (error) {
      toast({ title: 'Unable to save salesperson', description: error.code === '23505' ? 'A salesperson with this name already exists.' : error.message, variant: 'destructive' });
      return false;
    }
    await refetch();
    toast({ title: id ? 'Salesperson updated' : 'Salesperson added' });
    return true;
  };
  const setActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('ledger_salespersons').update({ is_active }).eq('id', id).select('id').single();
    if (error) { toast({ title: 'Unable to update salesperson', description: error.message, variant: 'destructive' }); return; }
    await refetch();
  };
  return { salespersons, loading, refetch, saveSalesperson, setActive };
}