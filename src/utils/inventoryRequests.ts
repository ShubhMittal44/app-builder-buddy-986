// Builders for Manager/Staff inventory change requests.
// Requests never touch live stock; Admin approval applies them atomically on the server.

export type InvTable = 'glass_types' | 'glass_variants' | 'glass_stock_items' | 'stands';

export type InvOp =
  | { op: 'insert' | 'ensure'; table: InvTable; values: Record<string, any>; ref?: string; match?: string[]; log?: Record<string, any> }
  | { op: 'update'; table: InvTable; id: string; values: Record<string, any>; expected: Record<string, any>; log?: Record<string, any> }
  | { op: 'adjust'; item_id: string; stand_id: string; delta: number; remarks?: string | null }
  | { op: 'transfer'; item_id: string; from_stand_id: string; to_stand_id: string; quantity: number; remarks?: string | null }
  | { op: 'set_stand_qty'; item_id: string; stand_id: string; quantity: number; expected?: number; log?: Record<string, any> };

export interface FieldChange { field: string; current: any; proposed: any }

export interface ChangeRequestDraft {
  action_type: string;
  summary: string;
  operations: InvOp[];
  changes: FieldChange[];
  original_values?: Record<string, any> | null;
  stock_item_id?: string | null;
  stand_id?: string | null;
}

const same = (a: any, b: any) => {
  const na = a === '' || a === undefined ? null : a;
  const nb = b === '' || b === undefined ? null : b;
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb);
  return na === nb;
};

/** Only fields that actually change; unrelated fields are left untouched. */
export function diffFields(before: Record<string, any>, proposed: Record<string, any>, labels: Record<string, string> = {}) {
  const values: Record<string, any> = {};
  const expected: Record<string, any> = {};
  const changes: FieldChange[] = [];
  for (const [k, v] of Object.entries(proposed)) {
    if (same(before[k], v)) continue;
    values[k] = v;
    expected[k] = before[k] ?? null;
    changes.push({ field: labels[k] ?? k, current: before[k] ?? null, proposed: v });
  }
  return { values, expected, changes };
}

export function updateRequest(
  table: InvTable, action_type: string, summary: string, before: Record<string, any> & { id: string },
  proposed: Record<string, any>, labels: Record<string, string>, log: Record<string, any>,
): ChangeRequestDraft | null {
  const { values, expected, changes } = diffFields(before, proposed, labels);
  if (changes.length === 0) return null;
  return {
    action_type, summary,
    operations: [{ op: 'update', table, id: before.id, values, expected, log }],
    changes, original_values: before,
    stock_item_id: table === 'glass_stock_items' ? before.id : null,
    stand_id: table === 'stands' ? before.id : null,
  };
}

export function insertRequest(table: InvTable, action_type: string, summary: string, values: Record<string, any>, log: Record<string, any>): ChangeRequestDraft {
  return {
    action_type, summary,
    operations: [{ op: 'insert', table, values, log }],
    changes: Object.entries(values).map(([field, proposed]) => ({ field, current: null, proposed })),
  };
}

export function adjustRequest(p: { item_id: string; stand_id: string; mode: 'add_stock' | 'sale_stock'; quantity: number; remarks?: string; label: string; standLabel: string; currentTotal: number; currentStand: number }): ChangeRequestDraft {
  const q = Math.trunc(p.quantity);
  if (!(q > 0)) throw new Error('Quantity must be a whole number above zero');
  const delta = p.mode === 'add_stock' ? q : -q;
  return {
    action_type: p.mode,
    summary: `${p.mode === 'add_stock' ? 'Add' : 'Sale'} ${q} sheets · ${p.label} · Stand ${p.standLabel}`,
    operations: [{ op: 'adjust', item_id: p.item_id, stand_id: p.stand_id, delta, remarks: p.remarks || null }],
    changes: [
      { field: `Stand ${p.standLabel} sheets`, current: p.currentStand, proposed: p.currentStand + delta },
      { field: 'Total sheets', current: p.currentTotal, proposed: p.currentTotal + delta },
    ],
    stock_item_id: p.item_id, stand_id: p.stand_id,
  };
}

export function transferRequest(p: { item_id: string; from: string; to: string; quantity: number; remarks?: string; label: string; fromLabel: string; toLabel: string; fromQty: number; toQty: number }): ChangeRequestDraft {
  const q = Math.trunc(p.quantity);
  if (!(q > 0) || p.from === p.to) throw new Error('Choose two different stands and a quantity above zero');
  return {
    action_type: 'transfer_stock',
    summary: `Transfer ${q} sheets · ${p.label} · Stand ${p.fromLabel} → ${p.toLabel}`,
    operations: [{ op: 'transfer', item_id: p.item_id, from_stand_id: p.from, to_stand_id: p.to, quantity: q, remarks: p.remarks || null }],
    changes: [
      { field: `Stand ${p.fromLabel} sheets`, current: p.fromQty, proposed: p.fromQty - q },
      { field: `Stand ${p.toLabel} sheets`, current: p.toQty, proposed: p.toQty + q },
    ],
    stock_item_id: p.item_id, stand_id: p.from,
  };
}

/** Replace the stand breakup of one item. Removed stands become 0. */
export function breakupRequest(item_id: string, label: string, existing: { stand_id: string; quantity: number }[], rows: { stand_id: string; quantity: number }[], standLabel: (id: string) => string): ChangeRequestDraft | null {
  const next: Record<string, number> = {};
  rows.forEach(r => { if (r.stand_id) next[r.stand_id] = (next[r.stand_id] ?? 0) + Math.max(0, Math.trunc(Number(r.quantity) || 0)); });
  const prev: Record<string, number> = {};
  existing.forEach(r => { prev[r.stand_id] = Number(r.quantity); });
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const operations: InvOp[] = []; const changes: FieldChange[] = [];
  ids.forEach(id => {
    const a = prev[id] ?? 0, b = next[id] ?? 0;
    if (a === b) return;
    operations.push({ op: 'set_stand_qty', item_id, stand_id: id, quantity: b, expected: a, log: { action_type: 'updated_stock_item', comment: 'Stand breakup edited', stand_number: standLabel(id) } });
    changes.push({ field: `Stand ${standLabel(id)} sheets`, current: a, proposed: b });
  });
  if (!operations.length) return null;
  return { action_type: 'edit_stand_quantity', summary: `Edit stand-wise sheets · ${label}`, operations, changes, stock_item_id: item_id };
}

export interface ImportItem {
  glassType: string; thickness: string; company: string; color: string;
  size: { length: number; breadth: number; unit: string };
  totalSheets: number; notes: string;
  stands: { standNumber: string; standId: string | null; sheets: number }[];
}

/** One request per imported item so Admin approves each affected change individually. */
export function importRequests(items: ImportItem[], opts: { createMissingStands: boolean }): ChangeRequestDraft[] {
  return items.map(it => {
    const label = `${it.glassType} ${it.thickness} ${it.company}${it.color ? ' ' + it.color : ''} ${it.size.length}×${it.size.breadth} ${it.size.unit}`;
    const operations: InvOp[] = [
      { op: 'ensure', table: 'glass_types', ref: 't', match: ['glass_type_name'], values: { glass_type_name: it.glassType.trim(), notes: null }, log: { action_type: 'created_glass_type' } },
      { op: 'ensure', table: 'glass_variants', ref: 'v', match: ['glass_type_id', 'thickness', 'company_purchased', 'color'],
        values: { glass_type_id: '$ref:t', thickness: it.thickness || '-', company_purchased: it.company || 'General', color: it.color || null, notes: null }, log: { action_type: 'created_variant', glass_type_id: '$ref:t' } },
      { op: 'ensure', table: 'glass_stock_items', ref: 'i', match: ['glass_variant_id', 'length', 'breadth', 'unit'],
        values: { glass_variant_id: '$ref:v', length: it.size.length, breadth: it.size.breadth, unit: it.size.unit, number_of_sheets: it.totalSheets, comment: it.notes || null }, log: { action_type: 'import_inventory', glass_type_id: '$ref:t', glass_variant_id: '$ref:v' } },
      { op: 'update', table: 'glass_stock_items', id: '$ref:i', values: { number_of_sheets: it.totalSheets }, expected: {} as any,
        log: { action_type: 'import_inventory', glass_type_id: '$ref:t', glass_variant_id: '$ref:v', glass_stock_item_id: '$ref:i', new_total_quantity: it.totalSheets, comment: it.notes || null } },
    ];
    it.stands.forEach((s, idx) => {
      if (!s.standId && !opts.createMissingStands) return;
      const ref = `s${idx}`;
      operations.push({ op: 'ensure', table: 'stands', ref, match: ['stand_number'], values: { stand_number: s.standNumber.trim(), notes: 'Created during inventory import' } });
      operations.push({ op: 'set_stand_qty', item_id: '$ref:i', stand_id: `$ref:${ref}`, quantity: s.sheets,
        log: { action_type: 'import_inventory', glass_type_id: '$ref:t', glass_variant_id: '$ref:v', stand_number: s.standNumber, new_total_quantity: it.totalSheets } });
    });
    return {
      action_type: 'import_inventory',
      summary: `Import · ${label} · ${it.totalSheets} sheets`,
      operations,
      changes: [
        { field: 'Total sheets', current: null, proposed: it.totalSheets },
        ...it.stands.map(s => ({ field: `Stand ${s.standNumber} sheets`, current: null, proposed: s.sheets })),
      ],
    };
  });
}
