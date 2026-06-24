import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ---- Types ----
export type EntryType = 'Sale' | 'Amount Received' | 'Opening Balance' | 'Adjustment';
export type LedgerSource = 'order' | 'manual';

export interface Customer {
  id: string;
  customer_name: string;
  customer_name_norm: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  customer_id: string;
  entry_date: string;
  entry_type: EntryType;
  amount: number;
  payment_mode: string | null;
  notes: string | null;
  source: LedgerSource;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTotals {
  totalSale: number;
  totalReceived: number;
  balance: number;
}

// Signed amount: everything increases balance except "Amount Received" which decreases it.
export const signedAmount = (e: Pick<LedgerEntry, 'entry_type' | 'amount'>) =>
  e.entry_type === 'Amount Received' ? -Number(e.amount) : Number(e.amount);

export function computeTotals(entries: LedgerEntry[]): CustomerTotals {
  let totalSale = 0;
  let totalReceived = 0;
  let balance = 0;
  for (const e of entries) {
    if (e.entry_type === 'Sale') totalSale += Number(e.amount);
    if (e.entry_type === 'Amount Received') totalReceived += Number(e.amount);
    balance += signedAmount(e);
  }
  return { totalSale, totalReceived, balance };
}

// ---- List hook: all customers + all ledger entries, with computed totals ----
export function useCustomerLedger() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      supabase.from('customers' as any).select('*').order('customer_name'),
      supabase.from('customer_ledger_entries' as any).select('*'),
    ]);
    if (cRes.error) toast({ title: 'Error', description: cRes.error.message, variant: 'destructive' });
    else setCustomers((cRes.data as any) ?? []);
    if (eRes.error) toast({ title: 'Error', description: eRes.error.message, variant: 'destructive' });
    else setEntries((eRes.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalsByCustomer = useMemo(() => {
    const byCust: Record<string, LedgerEntry[]> = {};
    entries.forEach(e => { (byCust[e.customer_id] ??= []).push(e); });
    const map: Record<string, CustomerTotals> = {};
    customers.forEach(c => { map[c.id] = computeTotals(byCust[c.id] ?? []); });
    return map;
  }, [customers, entries]);

  const grandTotals = useMemo(() => {
    let totalSale = 0, totalReceived = 0, outstanding = 0;
    Object.values(totalsByCustomer).forEach(t => {
      totalSale += t.totalSale;
      totalReceived += t.totalReceived;
      outstanding += t.balance;
    });
    return { totalSale, totalReceived, outstanding, totalCustomers: customers.length };
  }, [totalsByCustomer, customers.length]);

  // ---- Customer CRUD ----
  const createCustomer = async (payload: { customer_name: string; phone: string | null; address: string | null; city: string | null; notes: string | null }) => {
    const { error } = await supabase.from('customers' as any).insert(payload as any);
    if (error) {
      const msg = error.message.includes('duplicate') ? 'A customer with this name already exists.' : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Customer added', description: payload.customer_name });
    await fetchAll(); return true;
  };

  const updateCustomer = async (id: string, payload: { customer_name: string; phone: string | null; address: string | null; city: string | null; notes: string | null }) => {
    const { error } = await supabase.from('customers' as any).update(payload as any).eq('id', id);
    if (error) {
      const msg = error.message.includes('duplicate') ? 'A customer with this name already exists.' : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Customer updated' });
    await fetchAll(); return true;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Customer deleted' });
    await fetchAll(); return true;
  };

  return {
    customers, entries, loading, totalsByCustomer, grandTotals,
    refetch: fetchAll, createCustomer, updateCustomer, deleteCustomer,
  };
}

// ---- Single customer ledger hook ----
export function useCustomerDetail(customerId: string | undefined) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [orderNumbers, setOrderNumbers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!customerId) { setLoading(false); return; }
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      supabase.from('customers' as any).select('*').eq('id', customerId).maybeSingle(),
      supabase.from('customer_ledger_entries' as any).select('*').eq('customer_id', customerId),
    ]);
    if (cRes.error) toast({ title: 'Error', description: cRes.error.message, variant: 'destructive' });
    else setCustomer((cRes.data as any) ?? null);
    const list: LedgerEntry[] = eRes.error ? [] : ((eRes.data as any) ?? []);
    if (eRes.error) toast({ title: 'Error', description: eRes.error.message, variant: 'destructive' });
    setEntries(list);

    // Fetch order numbers for linked entries
    const orderIds = Array.from(new Set(list.filter(e => e.order_id).map(e => e.order_id as string)));
    if (orderIds.length) {
      const { data } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
      const map: Record<string, number> = {};
      (data ?? []).forEach((o: any) => { map[o.id] = o.order_number; });
      setOrderNumbers(map);
    } else {
      setOrderNumbers({});
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totals = useMemo(() => computeTotals(entries), [entries]);

  const createEntry = async (payload: {
    entry_date: string; entry_type: EntryType; amount: number; payment_mode: string | null; notes: string | null;
  }) => {
    if (!customerId) return false;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('customer_ledger_entries' as any).insert({
      customer_id: customerId,
      source: 'manual',
      order_id: null,
      created_by: user?.id ?? null,
      ...payload,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Entry added' });
    await fetchAll(); return true;
  };

  const updateEntry = async (id: string, payload: {
    entry_date: string; entry_type: EntryType; amount: number; payment_mode: string | null; notes: string | null;
  }) => {
    const { error } = await supabase.from('customer_ledger_entries' as any).update(payload as any).eq('id', id).eq('source', 'manual');
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Entry updated' });
    await fetchAll(); return true;
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('customer_ledger_entries' as any).delete().eq('id', id).eq('source', 'manual');
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Entry deleted' });
    await fetchAll(); return true;
  };

  return { customer, entries, orderNumbers, totals, loading, refetch: fetchAll, createEntry, updateEntry, deleteEntry };
}
