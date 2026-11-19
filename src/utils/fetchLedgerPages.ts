import { supabase } from '@/integrations/supabase/client';

// PostgREST caps each response; stable ordering makes totals/exports complete.
export async function fetchLedgerPages(table: 'customers' | 'customer_ledger_entries' | 'ledger_salespersons', customerId?: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table as any).select('*').order('id').range(offset, offset + pageSize - 1);
    if (customerId && table === 'customer_ledger_entries') query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
}