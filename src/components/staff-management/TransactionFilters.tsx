import { DateFilters } from '@/hooks/useDateFilters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Filter } from 'lucide-react';
import React from 'react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 5 }, (_, i) => 2023 + i);

interface Props {
  filters: DateFilters;
  onUpdate: (key: keyof DateFilters, val: string) => void;
  onClear: () => void;
  hasFilters: boolean;
  children?: React.ReactNode;
}

export function TransactionFilters({ filters, onUpdate, onClear, hasFilters, children }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border bg-muted/30 mb-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
        <Filter className="w-3.5 h-3.5" /> Filters
      </div>
      {children}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={filters.fromDate} onChange={e => onUpdate('fromDate', e.target.value)} className="w-36 h-8 text-xs" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={filters.toDate} onChange={e => onUpdate('toDate', e.target.value)} className="w-36 h-8 text-xs" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Month</Label>
        <select
          value={filters.month}
          onChange={e => onUpdate('month', e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[70px]"
        >
          <option value="">All</option>
          {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Year</Label>
        <select
          value={filters.year}
          onChange={e => onUpdate('year', e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[70px]"
        >
          <option value="">All</option>
          {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs text-destructive">
          <X className="w-3 h-3 mr-1" />Clear
        </Button>
      )}
    </div>
  );
}

interface SummaryStripProps {
  label: string;
  total: number;
  count: number;
  formatINR: (n: number) => string;
}

export function SummaryStrip({ label, total, count, formatINR }: SummaryStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-3 py-2 rounded-md bg-primary/5 border border-primary/10 mb-2 text-sm">
      <span className="font-medium text-primary">{label}: <strong>{formatINR(total)}</strong></span>
      <span className="text-muted-foreground">{count} {count === 1 ? 'entry' : 'entries'}</span>
    </div>
  );
}
