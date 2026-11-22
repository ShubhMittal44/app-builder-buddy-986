import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  type ChangeRequestDraft, updateRequest, insertRequest, adjustRequest, transferRequest, breakupRequest, importRequests,
} from '@/utils/inventoryRequests';

export const REQUEST_SUBMITTED_MSG = 'Request submitted successfully. Inventory will update after Admin approval.';

/** Manager/Staff: store a pending request. Never changes live stock. */
export async function submitInventoryRequest(d: ChangeRequestDraft): Promise<boolean> {
  const { error } = await supabase.rpc('submit_inventory_change_request' as any, {
    p_action_type: d.action_type, p_summary: d.summary, p_operations: d.operations as any,
    p_changes: d.changes as any, p_original_values: (d.original_values ?? null) as any,
    p_stock_item_id: d.stock_item_id ?? null, p_stand_id: d.stand_id ?? null,
  } as any);
  if (error) { toast({ title: 'Request not submitted', description: error.message, variant: 'destructive' }); return false; }
  return true;
}

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
  | 'sale_stock'
  | 'import_inventory'
  | 'transfer_stock';


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
  const { isAdmin } = useAuth();
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
    if (!isAdmin) {
      const ok = await submitInventoryRequest(insertRequest('stands', 'add_stand', `Add stand ${payload.stand_number.trim()}`,
        { stand_number: payload.stand_number.trim(), notes: payload.notes ?? null }, { action_type: 'created_stand' }));
      if (ok) toast({ title: 'Submitted for approval', description: REQUEST_SUBMITTED_MSG });
      return ok;
    }
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
    if (!isAdmin) {
      const before = stands.find(x => x.id === id);
      if (!before) return false;
      const d = updateRequest('stands', 'edit_stand', `Edit stand ${before.stand_number}`, before as any, patch,
        { stand_number: 'Stand number', is_active: 'Active', notes: 'Notes' }, { action_type: 'updated_stand', stand_id: id, stand_number: before.stand_number });
      if (!d) { toast({ title: 'No changes to submit' }); return false; }
      const ok = await submitInventoryRequest(d);
      if (ok) toast({ title: 'Submitted for approval', description: REQUEST_SUBMITTED_MSG });
      return ok;
    }
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
    if (!isAdmin) {
      const it = stockItems.find(i => i.id === inventoryId);
      const d = breakupRequest(inventoryId, it ? `${it.length}×${it.breadth} ${it.unit}` : 'item',
        existing.map(e => ({ stand_id: e.stand_id, quantity: Number(e.quantity) })),
        Object.entries(merged).map(([stand_id, quantity]) => ({ stand_id, quantity })),
        sid => stands.find(x => x.id === sid)?.stand_number ?? 'Unknown');
      if (!d) { toast({ title: 'No changes to submit' }); return false; }
      const ok = await submitInventoryRequest(d);
      if (ok) toast({ title: 'Submitted for approval', description: REQUEST_SUBMITTED_MSG });
      return ok;
    }

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


  const submitted = async (d: ChangeRequestDraft | null) => {
    if (!d) { toast({ title: 'No changes to submit' }); return false; }
    const ok = await submitInventoryRequest(d);
    if (ok) toast({ title: 'Submitted for approval', description: REQUEST_SUBMITTED_MSG });
    return ok;
  };

  // ---- Glass type CRUD ----
  const createGlassType = async (payload: { glass_type_name: string; notes: string | null }) => {
    if (!isAdmin) return submitted(insertRequest('glass_types', 'add_glass_type', `Add glass type ${payload.glass_type_name}`, payload, { action_type: 'created_glass_type' }));
    const { data, error } = await supabase.from('glass_types' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: (data as any).id, action_type: 'created_glass_type', new_value: payload });
    toast({ title: 'Glass type added', description: payload.glass_type_name });
    await fetchAll(); return true;
  };

  const updateGlassType = async (id: string, payload: { glass_type_name: string; notes: string | null }) => {
    const before = glassTypes.find(t => t.id === id);
    if (!isAdmin) return before ? submitted(updateRequest('glass_types', 'edit_glass_type', `Edit glass type ${before.glass_type_name}`, before as any, payload,
      { glass_type_name: 'Glass type', notes: 'Notes' }, { action_type: 'updated_glass_type', glass_type_id: id })) : false;
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
    if (!isAdmin) {
      const tn = glassTypes.find(t => t.id === payload.glass_type_id)?.glass_type_name ?? '';
      return submitted(insertRequest('glass_variants', 'add_glass_variant', `Add variant ${tn} ${payload.thickness} ${payload.company_purchased}${payload.color ? ' ' + payload.color : ''}`,
        payload, { action_type: 'created_variant', glass_type_id: payload.glass_type_id }));
    }
    const { data, error } = await supabase.from('glass_variants' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: payload.glass_type_id, glass_variant_id: (data as any).id, action_type: 'created_variant', new_value: payload });
    toast({ title: 'Variant added', description: `${payload.thickness} ${payload.company_purchased}${payload.color ? ` · ${payload.color}` : ''}` });
    await fetchAll(); return true;
  };

  const updateVariant = async (id: string, payload: { thickness: string; company_purchased: string; color: string | null; notes: string | null }) => {
    const before = variants.find(v => v.id === id);
    if (!isAdmin) return before ? submitted(updateRequest('glass_variants', 'edit_glass_variant',
      `Edit variant ${glassTypes.find(t => t.id === before.glass_type_id)?.glass_type_name ?? ''} ${before.thickness} ${before.company_purchased}`, before as any, payload,
      { thickness: 'Thickness', company_purchased: 'Company', color: 'Colour', notes: 'Notes' }, { action_type: 'updated_variant', glass_type_id: before.glass_type_id, glass_variant_id: id })) : false;
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
    if (!isAdmin) return submitted(insertRequest('glass_stock_items', 'add_stock_item',
      `Add size ${payload.length}×${payload.breadth} ${payload.unit} (${payload.number_of_sheets} sheets) · ${variant ? `${variant.thickness} ${variant.company_purchased}` : ''}`,
      payload, { action_type: 'created_stock_item', glass_type_id: variant?.glass_type_id, glass_variant_id: payload.glass_variant_id }));
    const { data, error } = await supabase.from('glass_stock_items' as any).insert(payload as any).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return false; }
    await logActivity({ glass_type_id: variant?.glass_type_id, glass_variant_id: payload.glass_variant_id, glass_stock_item_id: (data as any).id, action_type: 'created_stock_item', new_value: payload });
    toast({ title: 'Stock item added' });
    await fetchAll(); return true;
  };

  const updateStockItem = async (id: string, payload: { length: number; breadth: number; unit: Unit; number_of_sheets: number; comment: string | null }) => {
    const before = stockItems.find(i => i.id === id);
    const variant = variants.find(v => v.id === before?.glass_variant_id);
    if (!isAdmin) return before ? submitted(updateRequest('glass_stock_items', 'edit_stock_item',
      `Edit size ${before.length}×${before.breadth} ${before.unit} · ${variant ? `${variant.thickness} ${variant.company_purchased}` : ''}`, before as any, payload,
      { length: 'Length', breadth: 'Breadth', unit: 'Unit', number_of_sheets: 'Total sheets', comment: 'Comment' },
      { action_type: 'updated_stock_item', glass_type_id: variant?.glass_type_id, glass_variant_id: before.glass_variant_id, glass_stock_item_id: id })) : false;
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
  const itemLabel = (itemId: string) => {
    const it = stockItems.find(i => i.id === itemId);
    const v = variants.find(x => x.id === it?.glass_variant_id);
    const t = glassTypes.find(x => x.id === v?.glass_type_id);
    return it ? `${t?.glass_type_name ?? ''} ${v?.thickness ?? ''} ${v?.company_purchased ?? ''}${v?.color ? ' ' + v.color : ''} ${it.length}×${it.breadth} ${it.unit}`.trim() : 'item';
  };
  const standQty = (itemId: string, standId: string) => Number(standQuantities.find(q => q.inventory_id === itemId && q.stand_id === standId)?.quantity ?? 0);

  const adjustStock = async (payload: { inventory_id: string; stand_id: string; action_type: 'add_stock' | 'sale_stock'; quantity: number; remarks?: string }) => {
    if (!isAdmin) {
      const it = stockItems.find(i => i.id === payload.inventory_id);
      return submitted(adjustRequest({
        item_id: payload.inventory_id, stand_id: payload.stand_id, mode: payload.action_type, quantity: payload.quantity, remarks: payload.remarks,
        label: itemLabel(payload.inventory_id), standLabel: standById[payload.stand_id]?.stand_number ?? '',
        currentTotal: Number(it?.number_of_sheets ?? 0), currentStand: standQty(payload.inventory_id, payload.stand_id),
      }));
    }
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

  // ---- Stand transfer: Admin applies immediately via the same atomic server path; others submit a request ----
  const transferStock = async (p: { inventory_id: string; from: string; to: string; quantity: number; remarks?: string }) => {
    const d = transferRequest({
      item_id: p.inventory_id, from: p.from, to: p.to, quantity: p.quantity, remarks: p.remarks, label: itemLabel(p.inventory_id),
      fromLabel: standById[p.from]?.stand_number ?? '', toLabel: standById[p.to]?.stand_number ?? '',
      fromQty: standQty(p.inventory_id, p.from), toQty: standQty(p.inventory_id, p.to),
    });
    if (!isAdmin) return submitted(d);
    // Admin: submit + approve in one go so the move is atomic and logged once.
    const { data: id, error } = await supabase.rpc('submit_inventory_change_request' as any, {
      p_action_type: d.action_type, p_summary: d.summary, p_operations: d.operations as any, p_changes: d.changes as any,
      p_original_values: null, p_stock_item_id: d.stock_item_id, p_stand_id: d.stand_id,
    } as any);
    const res = error ? { error } : await supabase.rpc('review_inventory_change_request' as any, { p_request_id: id, p_decision: 'approve' } as any);
    if (res.error) { toast({ title: 'Transfer failed', description: res.error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Stock transferred' });
    await fetchAll(); return true;
  };

  // ---- Bulk import (admin only, enforced by RLS) ----
  // items come from utils/inventoryImport buildImportPlan()
  const importInventory = async (
    items: {
      glassType: string; thickness: string; company: string; color: string;
      size: { length: number; breadth: number; unit: Unit };
      totalSheets: number; notes: string;
      stands: { standNumber: string; standId: string | null; sheets: number }[];
    }[],
    opts: { createMissingStands: boolean },
  ): Promise<{ ok: boolean; created: number; updated: number; standsCreated: number; error?: string }> => {
    const norm = (s: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, '');
    let created = 0, updated = 0, standsCreated = 0;
    if (!isAdmin) {
      let sent = 0;
      for (const d of importRequests(items, opts)) { if (await submitInventoryRequest(d)) sent++; else break; }
      return { ok: sent === items.length, created: 0, updated: 0, standsCreated: 0, requests: sent,
        error: sent === items.length ? undefined : `${sent} of ${items.length} requests submitted` } as any;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;

      const typeMap = new Map(glassTypes.map(t => [norm(t.glass_type_name), t.id]));
      const variantMap = new Map(variants.map(v => [`${v.glass_type_id}|${norm(v.thickness)}|${norm(v.company_purchased)}|${norm(v.color ?? '')}`, v.id]));
      const itemMap = new Map(stockItems.map(i => [`${i.glass_variant_id}|${Number(i.length)}|${Number(i.breadth)}|${i.unit}`, i]));
      const standMap = new Map(stands.map(s => [norm(s.stand_number), s.id]));
      const sqMap = new Map(standQuantities.map(q => [`${q.inventory_id}|${q.stand_id}`, q]));

      const logs: any[] = [];

      for (const it of items) {
        // 1. glass type
        let typeId = typeMap.get(norm(it.glassType));
        if (!typeId) {
          const { data, error } = await supabase.from('glass_types' as any)
            .insert({ glass_type_name: it.glassType.trim(), notes: null } as any).select('id').single();
          if (error) throw error;
          typeId = (data as any).id;
          typeMap.set(norm(it.glassType), typeId!);
        }

        // 2. variant
        const vKey = `${typeId}|${norm(it.thickness)}|${norm(it.company)}|${norm(it.color)}`;
        let variantId = variantMap.get(vKey);
        if (!variantId) {
          const { data, error } = await supabase.from('glass_variants' as any).insert({
            glass_type_id: typeId,
            thickness: it.thickness || '-',
            company_purchased: it.company || 'General',
            color: it.color || null,
            notes: null,
          } as any).select('id').single();
          if (error) throw error;
          variantId = (data as any).id;
          variantMap.set(vKey, variantId!);
        }

        // 3. stock item
        const iKey = `${variantId}|${it.size.length}|${it.size.breadth}|${it.size.unit}`;
        const existingItem = itemMap.get(iKey);
        let stockItemId: string;
        let prevTotal = 0;
        if (existingItem) {
          prevTotal = Number(existingItem.number_of_sheets);
          stockItemId = existingItem.id;
          const { error } = await supabase.from('glass_stock_items' as any)
            .update({ number_of_sheets: it.totalSheets, comment: it.notes || existingItem.comment } as any)
            .eq('id', stockItemId);
          if (error) throw error;
          updated++;
        } else {
          const { data, error } = await supabase.from('glass_stock_items' as any).insert({
            glass_variant_id: variantId,
            length: it.size.length,
            breadth: it.size.breadth,
            unit: it.size.unit,
            number_of_sheets: it.totalSheets,
            comment: it.notes || null,
          } as any).select('id').single();
          if (error) throw error;
          stockItemId = (data as any).id;
          created++;
        }

        // 4. stands + stand quantities
        const usedStands: { standNumber: string; sheets: number; prev: number }[] = [];
        for (const s of it.stands) {
          let standId = s.standId ?? standMap.get(norm(s.standNumber)) ?? null;
          if (!standId) {
            if (!opts.createMissingStands) continue;
            const { data, error } = await supabase.from('stands' as any)
              .insert({ stand_number: s.standNumber.trim(), notes: 'Created during inventory import' } as any)
              .select('id').single();
            if (error) throw error;
            standId = (data as any).id;
            standMap.set(norm(s.standNumber), standId!);
            standsCreated++;
          }
          const row = sqMap.get(`${stockItemId}|${standId}`);
          const prev = row ? Number(row.quantity) : 0;
          if (row) {
            const { error } = await supabase.from('inventory_stand_quantities' as any)
              .update({ quantity: s.sheets } as any).eq('id', row.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('inventory_stand_quantities' as any)
              .insert({ inventory_id: stockItemId, stand_id: standId, quantity: s.sheets } as any);
            if (error) throw error;
          }
          usedStands.push({ standNumber: s.standNumber, sheets: s.sheets, prev });
          logs.push({
            glass_type_id: typeId,
            glass_variant_id: variantId,
            glass_stock_item_id: stockItemId,
            action_type: 'import_inventory',
            stand_id: standId,
            stand_number: s.standNumber,
            previous_total_quantity: prevTotal,
            new_total_quantity: it.totalSheets,
            previous_stand_quantity: prev,
            new_stand_quantity: s.sheets,
            comment: it.notes || null,
            changed_by: userId,
            new_value: { ...it, stands: undefined, stand: s },
          });
        }

        if (usedStands.length === 0) {
          logs.push({
            glass_type_id: typeId,
            glass_variant_id: variantId,
            glass_stock_item_id: stockItemId,
            action_type: 'import_inventory',
            stand_id: null,
            stand_number: 'No Stand Assigned',
            previous_total_quantity: prevTotal,
            new_total_quantity: it.totalSheets,
            comment: it.notes || null,
            changed_by: userId,
            new_value: { ...it, stands: undefined },
          });
        }
      }

      if (logs.length) {
        const { error } = await supabase.from('inventory_activity_log' as any).insert(logs as any);
        if (error) console.error('Import activity log error:', error);
      }

      await fetchAll();
      return { ok: true, created, updated, standsCreated };
    } catch (err: any) {
      console.error('Inventory import error:', err);
      return { ok: false, created, updated, standsCreated, error: err.message || 'Import failed' };
    }
  };

  return {
    glassTypes, variants, stockItems, loading,
    sheetsByVariant, variantsByType, sheetsByType,
    stands, standQuantities, standById, standQtyByItem, standTotalByItem,
    standBreakupByVariant, standTotalByVariant,
    createStand, updateStand, deleteStand, saveStandBreakup,
    refetch: fetchAll,
    createGlassType, updateGlassType, deleteGlassType,
    createVariant, updateVariant, deleteVariant,
    createStockItem, updateStockItem, deleteStockItem, adjustStock, transferStock, isAdmin,
    importInventory,
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
