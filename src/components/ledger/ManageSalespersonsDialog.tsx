import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { useLedgerSalespersons } from '@/hooks/useLedgerSalespersons';

export function ManageSalespersonsDialog({ open, onOpenChange, ledger, counts, canAdd, canEdit }: {
  open: boolean; onOpenChange: (value: boolean) => void;
  ledger: ReturnType<typeof useLedgerSalespersons>; counts: Record<string, number>; canAdd: boolean; canEdit: boolean;
}) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const reset = () => { setName(''); setEditingId(undefined); };
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (await ledger.saveSalesperson(name, editingId)) reset();
    setSaving(false);
  };
  return <Dialog open={open} onOpenChange={v => { onOpenChange(v); reset(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Manage Salespersons</DialogTitle></DialogHeader>
      {(canAdd || (canEdit && editingId)) && <div className="space-y-2">
        <Label htmlFor="salesperson-name">Salesperson Name</Label>
        <Input id="salesperson-name" value={name} onChange={e => setName(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving...' : editingId ? 'Save Name' : 'Add Salesperson'}</Button>
          {editingId && <Button variant="outline" onClick={reset}>Cancel</Button>}
        </div>
      </div>}
      {ledger.loading ? <p className="text-muted-foreground">Loading...</p> : ledger.salespersons.length === 0 ? <p className="text-muted-foreground">No salespersons yet.</p> :
        <ul className="divide-y">{ledger.salespersons.map(s => <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-medium break-words">{s.name} {!s.is_active && <Badge variant="secondary">Inactive</Badge>}</p><p className="text-sm text-muted-foreground">Assigned Customers: {counts[s.id] ?? 0}</p></div>
          {canEdit && <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} title="Edit name" onClick={() => { setEditingId(s.id); setName(s.name); }} disabled={saving}><Pencil className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={async () => { setSaving(true); await ledger.setActive(s.id, !s.is_active); setSaving(false); }}>{s.is_active ? 'Deactivate' : 'Reactivate'}</Button>
          </div>}
        </li>)}</ul>}
    </DialogContent>
  </Dialog>;
}