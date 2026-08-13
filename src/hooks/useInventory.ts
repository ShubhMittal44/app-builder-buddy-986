import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ---- Types ----
export type Unit = 'ft' | 'inch' | 'mm';

export type ActionType =
  | 'created_glass_type'
  | 'created_variant'
  | 'created_stock_item'
  | 'updated_stock_item'
  | 'deleted_stock_item'
  | 'updated_variant'
  | 'deleted_variant'
  | 'updated_glass_type'
  | 'deleted_glass_type'
  | 'add_stock'
  | 'sale_stock';

export interface GlassType {
  id: string;
  glass_type_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlassVariant {
  id: string;
  glass_type_id: string;
  thickness: string;
  company_purchased: string;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlassStockItem {
  id: string;
  glass_variant_id: string;
  length: number;
  breadth: number;
  unit: Unit;
  number_of_sheets: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stand {
  id: string;
  stand_number: string;
  stand_number_norm: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryStandQuantity {
  id: string;
  inventory_id: string;
  stand_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  glass_type_id: string | null;
  glass_variant_id: string | null;
  glass_stock_item_id: string | null;
  action_type: ActionType;
  old_value: any;
  new_value: any;
  comment: string | null;
  changed_by: string | null;
  changed_at: string;
  stand_id?: string | null;
  stand_number?: string | null;
  previous_total_quantity?: number | null;
  new_total_quantity?: number | null;
  previous_stand_quantity?: number | null;
  new_stand_quantity?: number | null;
}


async function logActivity(entry: {
  glass_type_id?: string | null;
  glass_variant_id?: string | null;
  glass_stock_item_id?: string | null;
  action_type: ActionType;
  old_value?: any;
  new_value?: any;
  comment?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('inventory_activity_log' as any).insert({
    ...entry,
    changed_by: user?.id ?? null,
  } as any);
}

// ---- Main inventory hook: loads everything and computes totals ----
export function useInventory() {
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);
  const [variants, setVariants] = useState<GlassVariant[]>([]);
  const [stockItems, setStockItems] = useState<GlassStockItem[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [standQuantities, setStandQuantities] = useState<InventoryStandQuantity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [typesRes, variantsRes, itemsRes, standsRes, sqRes] = await Promise.all([
      supabase.from('glass_types' as any).select('*').order('glass_type_name'),
      supabase.from('glass_variants' as any).select('*').order('created_at'),
      supabase.from('glass_stock_items' as any).select('*').order('created_at'),
      supabase.from('stands' as any).select('*').order('stand_number'),
      supabase.from('inventory_stand_quantities' as any).select('*'),
    ]);
    if (typesRes.error) toast({ title: 'Error', description: typesRes.error.message, variant: 'destructive' });
    else setGlassTypes((typesRes.data as any) ?? []);
    if (variantsRes.error) toast({ title: 'Error', description: variantsRes.error.message, variant: 'destructive' });
    else setVariants((variantsRes.data as any) ?? []);
    if (itemsRes.error) toast({ title: 'Error', description: itemsRes.error.message, variant: 'destructive' });
    else setStockItems((itemsRes.data as any) ?? []);
    if (standsRes.error) toast({ title: 'Error', description: standsRes.error.message, variant: 'destructive' });
    else setStands((standsRes.data as any) ?? []);
    if (sqRes.error) toast({ title: 'Error', description: sqRes.error.message, variant: 'destructive' });
    else setStandQuantities((sqRes.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Computed totals ----
  const sheetsByVariant = useMemo(() => {
    const m: Record<string, number> = {};
    stockItems.forEach(i => { m[i.glass_variant_id] = (m[i.glass_variant_id] ?? 0) + Number(i.number_of_sheets); });
    return m;
  }, [stockItems]);

  const variantsByType = useMemo(() => {
    const m: Record<string, GlassVariant[]> = {};
    variants.forEach(v => { (m[v.glass_type_id] ??= []).push(v); });
    return m;
  }, [variants]);

  const sheetsByType = useMemo(() => {
    const m: Record<string, number> = {};
    variants.forEach(v => {
      m[v.glass_type_id] = (m[v.glass_type_id] ?? 0) + (sheetsByVariant[v.id] ?? 0);
    });
    glassTypes.forEach(t => { m[t.id] ??= 0; });
    return m;
  }, [variants, sheetsByVariant, glassTypes]);

  // ---- Stand-wise computed maps ----
  const standById = useMemo(
    () => Object.fromEntries(stands.map(s => [s.id, s])) as Record<string, Stand>,
    [stands]
  );

  // stand rows grouped by inventory (stock item) id
  const standQtyByItem = useMemo(() => {
    const m: Record<string, InventoryStandQuantity[]> = {};
    standQuantities.forEach(q => { (m[q.inventory_id] ??= []).push(q); });
    Object.values(m).forEach(list => list.sort((a, b) => Number(b.quantity) - Number(a.quantity)));
    return m;
  }, [standQuantities]);

  // total stand-assigned sheets per stock item
  const standTotalByItem = useMemo(() => {
    const m: Record<string, number> = {};
    standQuantities.forEach(q => { m[q.inventory_id] = (m[q.inventory_id] ?? 0) + Number(q.quantity); });
    return m;
  }, [standQuantities]);

  // aggregated stand breakup per variant: stand_id -> qty
  const standBreakupByVariant = useMemo(() => {
    const itemVariant: Record<string, string> = {};
    stockItems.forEach(i => { itemVariant[i.id] = i.glass_variant_id; });
    const m: Record<string, Record<string, number>> = {};
    standQuantities.forEach(q => {
      const vId = itemVariant[q.inventory_id];
      if (!vId) return;
      (m[vId] ??= {});
      m[vId][q.stand_id] = (m[vId][q.stand_id] ?? 0) + Number(q.quantity);
    });
    return m;
  }, [standQuantities, stockItems]);

  const standTotalByVariant = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(standBreakupByVariant).forEach(([vId, breakup]) => {
      m[vId] = Object.values(breakup).reduce((s, n) => s + n, 0);
    });
    return m;
  }, [standBreakupByVariant]);

  // ---- Stand master CRUD (admin only, enforced by RLS) ----
  const createStand = async (payload: { stand_number: string; notes?: string | null }) => {
    const { error } = await supabase.from('stands' as any).insert({
      stand_number: payload.stand_number.trim(),
      notes: payload.notes ?? null,
    } as any);
    if (error) {
      console.error('Create stand error:', error);
      const msg = error.code === '23505' ? 'A stand with this number already exists.' : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Stand added', description: payload.stand_number });
    await fetchAll(); return true;
  };

  const updateStand = async (id: string, payload: { stand_number?: string; is_active?: boolean; notes?: string | null }) => {
    const patch: any = { ...payload };
    if (typeof patch.stand_number === 'string') patch.stand_number = patch.stand_number.trim();
    const { error } = await supabase.from('stands' as any).update(patch).eq('id', id);
    if (error) {
      console.error('Update stand error:', error);
      const msg = error.code === '23505' ? 'A stand with this number already exists.' : error.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Stand updated' });
    await fetchAll(); return true;
  };

  const deleteStand = async (id: string) => {
    const inUse = standQuantities.some(q => q.stand_id === id);
    if (inUse) {
      toast({
        title: 'Stand in use',
        description: 'This stand has inventory linked to it. Deactivate it instead of deleting.',
        variant: 'destructive',
      });
      return false;
    }
    const { error } = await supabase.from('stands' as any).delete().eq('id', id);
    if (error) {
      console.error('Delete stand error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Stand deleted' });
    await fetchAll(); return true;
  };

  // ---- Stand breakup for a single stock item ----
  // rows: [{ stand_id, quantity }] — replaces the whole breakup for that item.
  const saveStandBreakup = async (inventoryId: string, rows: { stand_id: string; quantity: number }[]) => {
    // merge duplicates defensively
    const merged: Record<string, number> = {};
    rows.forEach(r => {
      if (!r.stand_id) return;
      merged[r.stand_id] = (merged[r.stand_id] ?? 0) + Math.max(0, Math.trunc(Number(r.quantity) || 0));
    });
    const existing = standQuantities.filter(q => q.inventory_id === inventoryId);
    const keep = new Set(Object.keys(merged));

    try {
      const toDelete = existing.filter(q => !keep.has(q.stand_id)).map(q => q.id);
      if (toDelete.length) {
        const { error } = await supabase.from('inventory_stand_quantities' as any).delete().in('id', toDelete);
        if (error) throw error;
      }
      for (const [stand_id, quantity] of Object.entries(merged)) {
        const row = existing.find(q => q.stand_id === stand_id);
        if (row) {
          const { error } = await supabase.from('inventory_stand_quantities' as any)
            .update({ quantity } as any).eq('id', row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('inventory_stand_quantities' as any)
            .insert({ inventory_id: inventoryId, stand_id, quantity } as any);
          if (error) throw error;
        }
      }
      toast({ title: 'Stand breakup saved' });
      await fetchAll();
      return true;
    } catch (err: any) {
      console.error('Save stand breakup error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to save stand breakup', variant: 'destructive' });
      return false;
    }
  };


  // ---- Glass type CRUD ----
  const createGlassType = async (payload: { glass_type_name: string; notes: string | null }) => {
    const { data, error } = await supabase.from('glass_types' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: (data as any).id, action_type: 'created_glass_type', new_value: payload });
    toast({ title: 'Glass type added', description: payload.glass_type_name });
    await fetchAll(); return true;
  };

  const updateGlassType = async (id: string, payload: { glass_type_name: string; notes: string | null }) => {
    const before = glassTypes.find(t => t.id === id);
    const { error } = await supabase.from('glass_types' as any).update(payload as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: id, action_type: 'updated_glass_type', old_value: before, new_value: payload });
    toast({ title: 'Glass type updated' });
    await fetchAll(); return true;
  };

  const deleteGlassType = async (id: string) => {
    const before = glassTypes.find(t => t.id === id);
    await logActivity({ glass_type_id: id, action_type: 'deleted_glass_type', old_value: before });
    const { error } = await supabase.from('glass_types' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Glass type deleted' });
    await fetchAll(); return true;
  };

  // ---- Variant CRUD ----
  const createVariant = async (payload: { glass_type_id: string; thickness: string; company_purchased: string; color: string | null; notes: string | null }) => {
    const { data, error } = await supabase.from('glass_variants' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: payload.glass_type_id, glass_variant_id: (data as any).id, action_type: 'created_variant', new_value: payload });
    toast({ title: 'Variant added', description: `${payload.thickness} ${payload.company_purchased}${payload.color ? ` · ${payload.color}` : ''}` });
    await fetchAll(); return true;
  };

  const updateVariant = async (id: string, payload: { thickness: string; company_purchased: string; color: string | null; notes: string | null }) => {
    const before = variants.find(v => v.id === id);
    const { error } = await supabase.from('glass_variants' as any).update(payload as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: before?.glass_type_id, glass_variant_id: id, action_type: 'updated_variant', old_value: before, new_value: payload });
    toast({ title: 'Variant updated' });
    await fetchAll(); return true;
  };

  const deleteVariant = async (id: string) => {
    const before = variants.find(v => v.id === id);
    await logActivity({ glass_type_id: before?.glass_type_id, glass_variant_id: id, action_type: 'deleted_variant', old_value: before });
    const { error } = await supabase.from('glass_variants' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Variant deleted' });
    await fetchAll(); return true;
  };

  // ---- Stock item CRUD ----
  const createStockItem = async (payload: { glass_variant_id: string; length: number; breadth: number; unit: Unit; number_of_sheets: number; comment: string | null }) => {
    const variant = variants.find(v => v.id === payload.glass_variant_id);
    const { data, error } = await supabase.from('glass_stock_items' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: variant?.glass_type_id, glass_variant_id: payload.glass_variant_id, glass_stock_item_id: (data as any).id, action_type: 'created_stock_item', new_value: payload });
    toast({ title: 'Stock item added' });
    await fetchAll(); return true;
  };

  const updateStockItem = async (id: string, payload: { length: number; breadth: number; unit: Unit; number_of_sheets: number; comment: string | null }) => {
    const before = stockItems.find(i => i.id === id);
    const variant = variants.find(v => v.id === before?.glass_variant_id);
    const { error } = await supabase.from('glass_stock_items' as any).update(payload as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: variant?.glass_type_id, glass_variant_id: before?.glass_variant_id, glass_stock_item_id: id, action_type: 'updated_stock_item', old_value: before, new_value: payload });
    toast({ title: 'Stock item updated' });
    await fetchAll(); return true;
  };

  const deleteStockItem = async (id: string) => {
    const before = stockItems.find(i => i.id === id);
    const variant = variants.find(v => v.id === before?.glass_variant_id);
    await logActivity({ glass_type_id: variant?.glass_type_id, glass_variant_id: before?.glass_variant_id, glass_stock_item_id: id, action_type: 'deleted_stock_item', old_value: before });
    const { error } = await supabase.from('glass_stock_items' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Stock item deleted' });
    await fetchAll(); return true;
  };

  // ---- Stock adjustment (Add Stock / Sale Stock) via secure edge function ----
  const adjustStock = async (payload: { inventory_id: string; action_type: 'add_stock' | 'sale_stock'; quantity: number; remarks?: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Auth required', description: 'You must be logged in', variant: 'destructive' });
        return false;
      }
      const { data, error } = await supabase.functions.invoke('adjust-inventory-stock', {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        // Surface the actual server error message when available
        let serverMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) serverMsg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: payload.action_type === 'add_stock' ? 'Stock added successfully.' : 'Stock sold/removed successfully.',
      });
      await fetchAll();
      return true;
    } catch (err: any) {
      console.error('Adjust stock error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to adjust stock', variant: 'destructive' });
      return false;
    }
  };

  return {
    glassTypes, variants, stockItems, loading,
    sheetsByVariant, variantsByType, sheetsByType,
    refetch: fetchAll,
    createGlassType, updateGlassType, deleteGlassType,
    createVariant, updateVariant, deleteVariant,
    createStockItem, updateStockItem, deleteStockItem, adjustStock,
  };
}

// ---- Activity log hook ----
export function useInventoryActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_activity_log' as any)
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(500);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setEntries((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: fetch };
}
