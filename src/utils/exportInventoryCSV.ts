import type { GlassType, GlassVariant, GlassStockItem, ActivityLogEntry } from '@/hooks/useInventory';

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(v => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const dateStr = () => new Date().toISOString().split('T')[0];

const INVENTORY_HEADERS = ['Glass Type', 'Thickness', 'Company', 'Color', 'Length', 'Breadth', 'Unit', 'Number of Sheets', 'Comment'];

function buildInventoryRows(
  types: GlassType[],
  variants: GlassVariant[],
  items: GlassStockItem[],
  typeFilterId?: string,
): string[] {
  const typeMap = new Map(types.map(t => [t.id, t]));
  const variantMap = new Map(variants.map(v => [v.id, v]));
  const rows: string[] = [];
  items
    .filter(i => {
      if (!typeFilterId) return true;
      const v = variantMap.get(i.glass_variant_id);
      return v?.glass_type_id === typeFilterId;
    })
    .forEach(i => {
      const v = variantMap.get(i.glass_variant_id);
      const t = v ? typeMap.get(v.glass_type_id) : undefined;
      rows.push(toCsvRow([
        t?.glass_type_name ?? '',
        v?.thickness ?? '',
        v?.company_purchased ?? '',
        v?.color ?? '',
        i.length, i.breadth, i.unit, i.number_of_sheets, i.comment,
      ]));
    });
  return rows;
}

export function exportAllInventory(types: GlassType[], variants: GlassVariant[], items: GlassStockItem[]) {
  const rows = buildInventoryRows(types, variants, items);
  downloadCsv([INVENTORY_HEADERS.join(','), ...rows].join('\n'), `inventory_all_${dateStr()}.csv`);
}

export function exportGlassTypeInventory(typeName: string, typeId: string, types: GlassType[], variants: GlassVariant[], items: GlassStockItem[]) {
  const rows = buildInventoryRows(types, variants, items, typeId);
  const safeName = typeName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  downloadCsv([INVENTORY_HEADERS.join(','), ...rows].join('\n'), `inventory_${safeName}_${dateStr()}.csv`);
}

export function exportActivityLog(
  entries: ActivityLogEntry[],
  typeNameById: Record<string, string>,
  variantById: Record<string, GlassVariant>,
  userNameById: Record<string, string>,
) {
  const headers = ['Date/Time', 'Action', 'Glass Type', 'Thickness', 'Company', 'Comment', 'Old Value', 'New Value', 'Changed By'];
  const rows = entries.map(e => {
    const v = e.glass_variant_id ? variantById[e.glass_variant_id] : undefined;
    const typeName = e.glass_type_id ? (typeNameById[e.glass_type_id] ?? '') : '';
    return toCsvRow([
      new Date(e.changed_at).toLocaleString(),
      e.action_type,
      typeName,
      v?.thickness ?? '',
      v?.company_purchased ?? '',
      e.comment,
      e.old_value ? JSON.stringify(e.old_value) : '',
      e.new_value ? JSON.stringify(e.new_value) : '',
      e.changed_by ? (userNameById[e.changed_by] ?? e.changed_by) : '',
    ]);
  });
  downloadCsv([headers.join(','), ...rows].join('\n'), `inventory_activity_log_${dateStr()}.csv`);
}
