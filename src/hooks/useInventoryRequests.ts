import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface InventoryChangeRequest {
  id: string;
  request_number: number;
  requested_by: string;
  requester_role: string;
  action_type: string;
  summary: string;
  operations: any[];
  changes: { field: string; current: any; proposed: any }[];
  original_values: any;
  affected_stock_item_id: string | null;
  affected_stand_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

/** Admin sees all requests; others see only their own (enforced by RLS). Live via Realtime. */
export function useInventoryRequests(onApplied?: () => void) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<InventoryChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('inventory_change_requests' as any)
      .select('*').order('created_at', { ascending: false }).limit(500);
    setRequests(((data as any) ?? []) as InventoryChangeRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inv-requests-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_change_requests' }, (payload: any) => {
        fetch();
        if (payload.new?.status === 'approved' && payload.old?.status !== 'approved') onApplied?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetch, onApplied]);

  const review = async (id: string, decision: 'approve' | 'reject', reason?: string) => {
    const { error } = await supabase.rpc('review_inventory_change_request' as any, {
      p_request_id: id, p_decision: decision, p_reason: reason ?? null,
    } as any);
    await fetch();
    return error ? error.message : null;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  return { requests, loading, pendingCount, refetch: fetch, review };
}
