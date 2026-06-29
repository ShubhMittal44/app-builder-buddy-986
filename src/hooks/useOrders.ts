import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type Order = Tables<'orders'>;
export type OrderInsert = TablesInsert<'orders'>;
export type OrderUpdate = TablesUpdate<'orders'>;
export type OrderStage = Enums<'order_stage_enum'>;
export type SiteEnum = Enums<'site_enum'>;

export interface TimelineEntry {
  timestamp: string;
  user: string;
  action: string;
  from_stage?: OrderStage;
  to_stage?: OrderStage;
}

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('order_number', { ascending: false });

      if (fetchError) throw fetchError;
      
      setOrders(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Real-time subscription
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change detected:', payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { orders, loading, error, refetch: fetchOrders };
};

export const useOrder = (id: string | undefined) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      setOrder(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch order';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // Real-time subscription for single order
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`
        },
        () => {
          fetchOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  return { order, loading, error, refetch: fetchOrder };
};

export const useOrderMutations = () => {
  const { user, profile } = useAuth();
  
  const createOrder = async (orderData: Omit<OrderInsert, 'timeline'> & { files?: any[] }) => {
    try {
      const timeline: TimelineEntry[] = [{
        timestamp: new Date().toISOString(),
        user: profile?.display_name || user?.email || 'Unknown',
        action: 'Order created',
        to_stage: 'intake'
      }];

      const { data, error } = await supabase
        .from('orders')
        .insert({
          ...orderData,
          timeline: timeline as any,
          files: (orderData.files || []) as any
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Order #${data.order_number} created successfully`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateOrder = async (id: string, updates: OrderUpdate) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order updated successfully',
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateStage = async (id: string, currentOrder: Order, newStage: OrderStage) => {
    try {
      const currentTimeline = Array.isArray(currentOrder.timeline) 
        ? currentOrder.timeline as unknown as TimelineEntry[]
        : [];
      
      const newTimelineEntry: TimelineEntry = {
        timestamp: new Date().toISOString(),
        user: profile?.display_name || user?.email || 'Unknown',
        action: `Stage changed to ${newStage}`,
        from_stage: currentOrder.stage,
        to_stage: newStage
      };

      // When an order is closed, treat it as fully paid: advance covers the full amount so balance = 0.
      const updatePayload: Record<string, any> = {
        stage: newStage,
        timeline: [...currentTimeline, newTimelineEntry] as any,
      };
      if (newStage === 'closed') {
        updatePayload.advance_amount = Number(currentOrder.total_amount || 0);
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Order moved to ${newStage} stage`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stage';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order deleted successfully',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete order';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const forceCloseOrder = async (id: string, currentOrder: Order) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to perform this action',
          variant: 'destructive',
        });
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('admin-force-close-order', {
        body: { order_id: id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        throw error;
      }

      const result = data as any;

      toast({
        title: 'Order closed',
        description: result.message || `Order force closed successfully`,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to force close order';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return { createOrder, updateOrder, updateStage, deleteOrder, forceCloseOrder };
};
