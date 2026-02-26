import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DateFilters, emptyFilters, getDateRange } from './useDateFilters';

// ---- Types ----
export interface StaffMember {
  id: string;
  created_at: string;
  updated_at: string;
  staff_name: string;
  monthly_salary: number;
  active: boolean;
  notes: string | null;
}

export interface StaffTransaction {
  id: string;
  created_at: string;
  updated_at: string;
  staff_id: string;
  entry_date: string;
  money_taken: number;
  notes: string | null;
}

export interface Vehicle {
  id: string;
  created_at: string;
  updated_at: string;
  vehicle_number: string;
  vehicle_type: string;
  active: boolean;
  notes: string | null;
}

export interface VehicleTransaction {
  id: string;
  created_at: string;
  updated_at: string;
  vehicle_id: string;
  entry_date: string;
  amount: number;
  reason: string;
  notes: string | null;
}

export interface OtherEntry {
  id: string;
  created_at: string;
  updated_at: string;
  entry_date: string;
  service: string;
  amount: number;
  notes: string | null;
}

// Helper to apply date filters to a query
function applyDateFilters(q: any, filters: DateFilters) {
  const { from, to } = getDateRange(filters);
  if (from) q = q.gte('entry_date', from);
  if (to) q = q.lte('entry_date', to);
  return q;
}

// ---- Staff Members Hook ----
export function useStaffMembers() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('staff_members').select('*').order('staff_name');
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else setMembers((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (m: Partial<StaffMember>) => {
    const { error } = await supabase.from('staff_members').insert(m as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, m: Partial<StaffMember>) => {
    const { error } = await supabase.from('staff_members').update(m as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('staff_members').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { members, loading, refetch: fetch, create, update, remove };
}

// ---- Staff Transactions Hook ----
export function useStaffTransactions(staffId: string | null, filters: DateFilters = emptyFilters) {
  const [transactions, setTransactions] = useState<StaffTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const filterKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    if (!staffId) { setTransactions([]); return; }
    setLoading(true);
    let q = supabase.from('staff_transactions').select('*').eq('staff_id', staffId);
    q = applyDateFilters(q, filters);
    q = q.order('entry_date', { ascending: false });
    const { data, error } = await q;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setTransactions((data as any) ?? []);
    setLoading(false);
  }, [staffId, filterKey]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (t: Partial<StaffTransaction>) => {
    const { error } = await supabase.from('staff_transactions').insert({ ...t, staff_id: staffId } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, t: Partial<StaffTransaction>) => {
    const { error } = await supabase.from('staff_transactions').update(t as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('staff_transactions').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { transactions, loading, refetch: fetch, create, update, remove };
}

// ---- Vehicles Hook ----
export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('vehicle_number');
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setVehicles((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (v: Partial<Vehicle>) => {
    const { error } = await supabase.from('vehicles').insert(v as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, v: Partial<Vehicle>) => {
    const { error } = await supabase.from('vehicles').update(v as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { vehicles, loading, refetch: fetch, create, update, remove };
}

// ---- Vehicle Transactions Hook ----
export function useVehicleTransactions(vehicleId: string | null, filters: DateFilters = emptyFilters) {
  const [transactions, setTransactions] = useState<VehicleTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const filterKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    if (!vehicleId) { setTransactions([]); return; }
    setLoading(true);
    let q = supabase.from('vehicle_transactions').select('*').eq('vehicle_id', vehicleId);
    q = applyDateFilters(q, filters);
    q = q.order('entry_date', { ascending: false });
    const { data, error } = await q;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setTransactions((data as any) ?? []);
    setLoading(false);
  }, [vehicleId, filterKey]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (t: Partial<VehicleTransaction>) => {
    const { error } = await supabase.from('vehicle_transactions').insert({ ...t, vehicle_id: vehicleId } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, t: Partial<VehicleTransaction>) => {
    const { error } = await supabase.from('vehicle_transactions').update(t as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('vehicle_transactions').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { transactions, loading, refetch: fetch, create, update, remove };
}

// ---- Other Entries Hook ----
export function useOtherEntries(filters: DateFilters = emptyFilters, serviceFilter: string = '') {
  const [entries, setEntries] = useState<OtherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('other_entries').select('*');
    q = applyDateFilters(q, filters);
    if (serviceFilter) q = q.ilike('service', `%${serviceFilter}%`);
    q = q.order('entry_date', { ascending: false });
    const { data, error } = await q;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setEntries((data as any) ?? []);
    setLoading(false);
  }, [filterKey, serviceFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (e: Partial<OtherEntry>) => {
    const { error } = await supabase.from('other_entries').insert(e as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const update = async (id: string, e: Partial<OtherEntry>) => {
    const { error } = await supabase.from('other_entries').update(e as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('other_entries').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await fetch(); return true;
  };

  return { entries, loading, refetch: fetch, create, update, remove };
}
