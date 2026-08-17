import * as XLSX from 'xlsx';
import type { GlassType, GlassVariant, GlassStockItem, Stand, Unit } from '@/hooks/useInventory';

export const IMPORT_HEADERS = [
  'Glass Type',
  'Thickness',
  'Company / Brand',
  'Color',
  'Size / Dimension',
  'Total Sheets',
  'Stand Number',
  'Stand Sheets',
  'Notes',
] as const;

const SAMPLE_ROWS: (string | number)[][] = [
  ['Reflective Glass', '5 mm', 'Gold Plus', 'Royal Blue', '8 x 4 ft', 1292, 'Stand 1', 400, 'Opening stock'],
  ['Reflective Glass', '5 mm', 'Gold Plus', 'Royal Blue', '8 x 4 ft', 1292, 'Stand 2', 300, ''],
  ['Reflective Glass', '5 mm', 'Gold Plus', 'Royal Blue', '8 x 4 ft', 1292, 'Stand 5', 592, ''],
  ['Plain Glass', '4 mm', 'Gold Plus', 'Clear', '6 x 4 ft', 50, '', '', 'No stand assigned yet'],
];

export function downloadImportTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([[...IMPORT_HEADERS], ...SAMPLE_ROWS]);
  ws['!cols'] = IMPORT_HEADERS.map(h => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory Import');
  XLSX.writeFile(wb, 'inventory_import_template.xlsx');
}

// ---- Normalization helpers ----
export const normKey = (s: string) => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, '');

export const normalizeThickness = (s: string) => {
  const t = (s ?? '').toString().trim();
  if (!t) return t;
  return /^\d+(\.\d+)?$/.test(t) ? `${t} mm` : t;
};

const UNITS: Unit[] = ['ft', 'inch', 'mm'];

export interface ParsedSize { length: number; breadth: number; unit: Unit; raw: string }

// Accepts "8 x 4 ft", "2140x1650 mm", "8*4", "8 X 4 inch"
export function parseSize(raw: string): ParsedSize {
  const s = (raw ?? '').toString().trim();
  const fallback: ParsedSize = { length: 0, breadth: 0, unit: 'mm', raw: s };
  if (!s) return fallback;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*[x×*]\s*(-?\d+(?:\.\d+)?)/i);
  if (!m) return fallback;
  const rest = s.slice((m.index ?? 0) + m[0].length).toLowerCase();
  let unit: Unit = 'mm';
  if (/\bft\b|feet|foot|'/.test(rest)) unit = 'ft';
  else if (/inch|"|\bin\b/.test(rest)) unit = 'inch';
  else if (/\bmm\b/.test(rest)) unit = 'mm';
  else {
    const found = UNITS.find(u => rest.includes(u));
    if (found) unit = found;
  }
  return { length: Number(m[1]), breadth: Number(m[2]), unit, raw: s };
}

export const sizeLabel = (p: { length: number; breadth: number; unit: Unit }) =>
  `${p.length} x ${p.breadth} ${p.unit}`;

// ---- Row / item models ----
export interface RawRow {
  rowNumber: number;
  glassType: string;
  thickness: string;
  company: string;
  color: string;
  size: string;
  totalSheets: number | null;
  standNumber: string;
  standSheets: number | null;
  notes: string;
}

export interface PlanStand {
  standNumber: string;
  standId: string | null; // existing stand match
  isNew: boolean;
  sheets: number;
  rows: number[];
}

export interface PlanItem {
  key: string;
  glassType: string;
  glassTypeId: string | null;
  thickness: string;
  company: string;
  color: string;
  size: ParsedSize;
  totalSheets: number;
  totalProvided: boolean;
  notes: string;
  stands: PlanStand[];
  standTotal: number;
  unassignedSheets: number; // rows with no stand number
  hasStands: boolean;
  variantId: string | null;
  stockItemId: string | null;
  rows: number[];
  warnings: string[];
}

export interface ImportPlan {
  items: PlanItem[];
  newStandNumbers: string[];
  warnings: string[];
  errors: string[];
  rowCount: number;
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
};

const HEADER_ALIASES: Record<string, keyof RawRow> = {
  glasstype: 'glassType',
  category: 'glassType',
  thickness: 'thickness',
  company: 'company',
  companybrand: 'company',
  brand: 'company',
  companypurchased: 'company',
  color: 'color',
  colour: 'color',
  size: 'size',
  sizedimension: 'size',
  dimension: 'size',
  totalsheets: 'totalSheets',
  sheets: 'totalSheets',
  standnumber: 'standNumber',
  stand: 'standNumber',
  standsheets: 'standSheets',
  standqty: 'standSheets',
  standquantity: 'standSheets',
  notes: 'notes',
  comment: 'notes',
};

export async function parseImportFile(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('The file has no readable sheet.');
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });
  return json.map((r, idx) => {
    const mapped: any = {};
    Object.entries(r).forEach(([k, v]) => {
      const key = HEADER_ALIASES[normKey(k).replace(/[^a-z0-9]/g, '')];
      if (key) mapped[key] = v;
    });
    return {
      rowNumber: idx + 2,
      glassType: String(mapped.glassType ?? '').trim(),
      thickness: normalizeThickness(String(mapped.thickness ?? '')),
      company: String(mapped.company ?? '').trim(),
      color: String(mapped.color ?? '').trim(),
      size: String(mapped.size ?? '').trim(),
      totalSheets: num(mapped.totalSheets),
      standNumber: String(mapped.standNumber ?? '').trim(),
      standSheets: num(mapped.standSheets),
      notes: String(mapped.notes ?? '').trim(),
    } as RawRow;
  }).filter(r =>
    r.glassType || r.thickness || r.company || r.color || r.size ||
    r.totalSheets !== null || r.standNumber || r.standSheets !== null
  );
}

export interface ExistingData {
  glassTypes: GlassType[];
  variants: GlassVariant[];
  stockItems: GlassStockItem[];
  stands: Stand[];
}

export function buildImportPlan(rows: RawRow[], existing: ExistingData): ImportPlan {
  const errors: string[] = [];
  const warnings: string[] = [];

  const typeByKey = new Map(existing.glassTypes.map(t => [normKey(t.glass_type_name), t]));
  const variantByKey = new Map(
    existing.variants.map(v => [
      `${v.glass_type_id}|${normKey(v.thickness)}|${normKey(v.company_purchased)}|${normKey(v.color ?? '')}`,
      v,
    ])
  );
  const itemByKey = new Map(
    existing.stockItems.map(i => [
      `${i.glass_variant_id}|${Number(i.length)}|${Number(i.breadth)}|${i.unit}`,
      i,
    ])
  );
  const standByKey = new Map(existing.stands.map(s => [normKey(s.stand_number), s]));

  const items = new Map<string, PlanItem>();

  rows.forEach(r => {
    if (!r.glassType) {
      errors.push(`Row ${r.rowNumber}: Glass Type is required — row skipped.`);
      return;
    }
    if (Number.isNaN(r.totalSheets as number)) {
      errors.push(`Row ${r.rowNumber}: Total Sheets is not a number — row skipped.`);
      return;
    }
    if (Number.isNaN(r.standSheets as number)) {
      errors.push(`Row ${r.rowNumber}: Stand Sheets is not a number — row skipped.`);
      return;
    }
    if ((r.standSheets ?? 0) < 0) {
      errors.push(`Row ${r.rowNumber}: Stand Sheets cannot be negative — row skipped.`);
      return;
    }
    if (r.standNumber && r.standSheets === null) {
      warnings.push(`Row ${r.rowNumber}: Stand Number "${r.standNumber}" has no Stand Sheets — treated as 0.`);
    }

    const size = parseSize(r.size);
    if (r.size && !size.length && !size.breadth) {
      warnings.push(`Row ${r.rowNumber}: could not read Size / Dimension "${r.size}" — stored as 0 x 0 mm.`);
    }
    const key = [
      normKey(r.glassType), normKey(r.thickness), normKey(r.company), normKey(r.color),
      size.length, size.breadth, size.unit,
    ].join('|');

    const type = typeByKey.get(normKey(r.glassType)) ?? null;
    const variant = type
      ? variantByKey.get(`${type.id}|${normKey(r.thickness)}|${normKey(r.company)}|${normKey(r.color)}`) ?? null
      : null;
    const stockItem = variant
      ? itemByKey.get(`${variant.id}|${size.length}|${size.breadth}|${size.unit}`) ?? null
      : null;

    let item = items.get(key);
    if (!item) {
      item = {
        key,
        glassType: r.glassType,
        glassTypeId: type?.id ?? null,
        thickness: r.thickness,
        company: r.company || 'General',
        color: r.color,
        size,
        totalSheets: 0,
        totalProvided: false,
        notes: r.notes,
        stands: [],
        standTotal: 0,
        unassignedSheets: 0,
        hasStands: false,
        variantId: variant?.id ?? null,
        stockItemId: stockItem?.id ?? null,
        rows: [],
        warnings: [],
      };
      items.set(key, item);
    }
    item.rows.push(r.rowNumber);
    if (r.notes && !item.notes) item.notes = r.notes;

    if (r.totalSheets !== null) {
      if (item.totalProvided && item.totalSheets !== r.totalSheets) {
        item.warnings.push(`Different Total Sheets values found (${item.totalSheets} and ${r.totalSheets}) — using ${Math.max(item.totalSheets, r.totalSheets)}.`);
        item.totalSheets = Math.max(item.totalSheets, r.totalSheets);
      } else {
        item.totalSheets = r.totalSheets;
      }
      item.totalProvided = true;
    }

    const sheets = Math.trunc(r.standSheets ?? 0);
    if (r.standNumber) {
      item.hasStands = true;
      const existingStand = item.stands.find(s => normKey(s.standNumber) === normKey(r.standNumber));
      if (existingStand) {
        existingStand.sheets += sheets;
        existingStand.rows.push(r.rowNumber);
        item.warnings.push(`Stand "${r.standNumber}" appears more than once — quantities combined (${existingStand.sheets}).`);
      } else {
        const master = standByKey.get(normKey(r.standNumber)) ?? null;
        item.stands.push({
          standNumber: master?.stand_number ?? r.standNumber,
          standId: master?.id ?? null,
          isNew: !master,
          sheets,
          rows: [r.rowNumber],
        });
      }
    } else if (sheets > 0) {
      item.unassignedSheets += sheets;
    }
  });

  const list = [...items.values()];
  list.forEach(it => {
    it.standTotal = it.stands.reduce((s, x) => s + x.sheets, 0);
    if (!it.totalProvided) {
      it.totalSheets = it.standTotal + it.unassignedSheets;
      it.warnings.push(`No Total Sheets given — using stand total (${it.totalSheets}).`);
    } else if (it.hasStands && it.standTotal !== it.totalSheets) {
      it.warnings.push(`Stand total mismatch: ${it.standTotal} / ${it.totalSheets}`);
    }
  });

  const newStandNumbers = [
    ...new Set(list.flatMap(i => i.stands.filter(s => s.isNew).map(s => s.standNumber))),
  ];

  return { items: list, newStandNumbers, warnings, errors, rowCount: rows.length };
}

// ---- Preview groupings ----
export function groupByStand(plan: ImportPlan) {
  const m = new Map<string, { standNumber: string; isNew: boolean; total: number; lines: { label: string; sheets: number }[] }>();
  plan.items.forEach(it => {
    it.stands.forEach(s => {
      const k = normKey(s.standNumber);
      const g = m.get(k) ?? { standNumber: s.standNumber, isNew: s.isNew, total: 0, lines: [] };
      g.total += s.sheets;
      g.lines.push({ label: itemLabel(it), sheets: s.sheets });
      m.set(k, g);
    });
  });
  return [...m.values()].sort((a, b) => a.standNumber.localeCompare(b.standNumber, undefined, { numeric: true }));
}

export function groupByCategory(plan: ImportPlan) {
  const m = new Map<string, { glassType: string; items: PlanItem[]; total: number }>();
  plan.items.forEach(it => {
    const k = normKey(it.glassType);
    const g = m.get(k) ?? { glassType: it.glassType, items: [], total: 0 };
    g.items.push(it);
    g.total += it.totalSheets;
    m.set(k, g);
  });
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export const itemLabel = (it: PlanItem) =>
  [it.glassType, it.thickness, it.company, it.color, it.size.raw || sizeLabel(it.size)]
    .filter(Boolean).join(' | ');
