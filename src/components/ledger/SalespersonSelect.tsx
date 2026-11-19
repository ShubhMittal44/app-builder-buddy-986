import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LedgerSalesperson } from '@/utils/ledgerSalespersons';

export function SalespersonSelect({ value, onChange, salespersons, filter = false, currentId, disabled = false }: {
  value: string; onChange: (value: string) => void; salespersons: LedgerSalesperson[];
  filter?: boolean; currentId?: string | null; disabled?: boolean;
}) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger aria-label={filter ? 'Filter by Salesperson' : 'Assigned Salesperson'}><SelectValue /></SelectTrigger>
    <SelectContent>
      {filter && <SelectItem value="all">All Salespersons</SelectItem>}
      <SelectItem value="unassigned">Unassigned</SelectItem>
      {salespersons.filter(s => filter || s.is_active || s.id === currentId).map(s =>
        <SelectItem key={s.id} value={s.id}>{s.name}{!s.is_active ? ' (Inactive)' : ''}</SelectItem>)}
    </SelectContent>
  </Select>;
}