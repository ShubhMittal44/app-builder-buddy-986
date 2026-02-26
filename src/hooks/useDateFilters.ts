import { useState } from 'react';

export interface DateFilters {
  fromDate: string;
  toDate: string;
  month: string; // '' or '1'-'12'
  year: string;  // '' or '2023', '2024', etc.
}

export const emptyFilters: DateFilters = { fromDate: '', toDate: '', month: '', year: '' };

export function getDateRange(f: DateFilters): { from?: string; to?: string } {
  if (f.fromDate || f.toDate) {
    return { from: f.fromDate || undefined, to: f.toDate || undefined };
  }
  const m = f.month ? parseInt(f.month) : 0;
  const y = f.year ? parseInt(f.year) : 0;
  if (m && y) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return { from: start, to: end };
  }
  if (y) return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (m) {
    const cy = new Date().getFullYear();
    const start = `${cy}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(cy, m, 0).getDate();
    const end = `${cy}-${String(m).padStart(2, '0')}-${lastDay}`;
    return { from: start, to: end };
  }
  return {};
}

export function filterSuffix(f: DateFilters): string {
  if (f.fromDate || f.toDate) return `_${f.fromDate || 'start'}_to_${f.toDate || 'end'}`;
  if (f.month && f.year) return `_${f.year}-${f.month.padStart(2, '0')}`;
  if (f.year) return `_${f.year}`;
  return `_${new Date().toISOString().split('T')[0]}`;
}

export function useDateFilters() {
  const [filters, setFilters] = useState<DateFilters>(emptyFilters);
  const clear = () => setFilters(emptyFilters);
  const update = (key: keyof DateFilters, val: string) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilters = Object.values(filters).some(v => v !== '');
  return { filters, setFilters, clear, update, hasFilters };
}
