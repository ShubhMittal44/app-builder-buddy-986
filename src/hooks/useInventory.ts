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
  | 'deleted_glass_type';

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
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [typesRes, variantsRes, itemsRes] = await Promise.all([
      supabase.from('glass_types' as any).select('*').order('glass_type_name'),
      supabase.from('glass_variants' as any).select('*').order('created_at'),
      supabase.from('glass_stock_items' as any).select('*').order('created_at'),
    ]);
    if (typesRes.error) toast({ title: 'Error', description: typesRes.error.message, variant: 'destructive' });
    else setGlassTypes((typesRes.data as any) ?? []);
    if (variantsRes.error) toast({ title: 'Error', description: variantsRes.error.message, variant: 'destructive' });
    else setVariants((variantsRes.data as any) ?? []);
    if (itemsRes.error) toast({ title: 'Error', description: itemsRes.error.message, variant: 'destructive' });
    else setStockItems((itemsRes.data as any) ?? []);
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

  return {
    glassTypes, variants, stockItems, loading,
    sheetsByVariant, variantsByType, sheetsByType,
    refetch: fetchAll,
    createGlassType, updateGlassType, deleteGlassType,
    createVariant, updateVariant, deleteVariant,
    createStockItem, updateStockItem, deleteStockItem,
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
