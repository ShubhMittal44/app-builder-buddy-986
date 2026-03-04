import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DateFilters, emptyFilters, getDateRange } from './useDateFilters';

export interface Client {
  id: string;
  client_name: string;
  client_name_norm: string;
  notes: string | null;
}

export interface DayBookEntry {
  id: string;
  created_at: string;
  updated_at: string;
  entry_date: string;
  client_id: string;
  challan_number: string;
  total_amount: number | null;
  advance_amount: number | null;
  notes: string | null;
}

type TabTable = 'daybook_entries' | 'toughened_diary_entries' | 'rama_entries';

function applyDateFilters(q: any, filters: DateFilters) {
  const { from, to } = getDateRange(filters);
  if (from) q = q.gte('entry_date', from);
  if (to) q = q.lte('entry_date', to);
  return q;
}

// ---- Clients Hook ----
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('client_name');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setClients((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const search = useCallback(async (query: string): Promise<Client[]> => {
    if (query.length < 3) return [];
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .ilike('client_name', `%${query}%`)
      .order('client_name')
      .limit(20);
    if (error) return [];
    return (data as any) ?? [];
  }, []);

  const create = async (name: string, notes?: string): Promise<Client | null> => {
    const norm = name.trim().toLowerCase();
    // Check duplicate
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('client_name_norm', norm)
      .limit(1);
    if (existing && existing.length > 0) {
      toast({ title: 'Client already exists', description: `"${name}" is already in the system.`, variant: 'destructive' });
      return null;
    }
    const { data, error } = await supabase
      .from('clients')
      .insert({ client_name: name.trim(), client_name_norm: norm, notes: notes || null } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetch();
    return data as any;
  };

  return { clients, loading, refetch: fetch, search, create };
}

// ---- DayBook Entries Hook (works for all 3 tables) ----
export function useDayBookEntries(
  table: TabTable,
  filters: DateFilters = emptyFilters,
  clientId: string = '',
  challanSearch: string = ''
) {
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from(table).select('*');
    q = applyDateFilters(q, filters);
    if (clientId) q = q.eq('client_id', clientId);
    if (challanSearch) q = q.ilike('challan_number', `%${challanSearch}%`);
    q = q.order('entry_date', { ascending: false }).limit(1000);
    const { data, error } = await q;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setEntries((data as any) ?? []);
    setLoading(false);
  }, [table, filterKey, clientId, challanSearch]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (entry: Partial<DayBookEntry>) => {
    const { error } = await supabase.from(table).insert(entry as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, entry: Partial<DayBookEntry>) => {
    const { error } = await supabase.from(table).update(entry as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { entries, loading, refetch: fetch, create, update, remove };
}
