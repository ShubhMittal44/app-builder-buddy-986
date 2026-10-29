import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { ModuleKey } from '@/contexts/AuthContext';

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'inventory', label: 'Inventory Management' },
  { key: 'daybook', label: 'DayBook' },
  { key: 'customer_ledger', label: 'Customer Ledger' },
];

export type PermRow = { module_key: ModuleKey; can_view: boolean; can_add: boolean; can_edit: boolean };

export const emptyPerms = (): PermRow[] =>
  MODULES.map((m) => ({ module_key: m.key, can_view: false, can_add: false, can_edit: false }));

/** Previous default access for Manager/Staff before per-user permissions existed. */
export const roleDefaultPerms = (): PermRow[] =>
  MODULES.map((m) => ({
    module_key: m.key,
    can_view: m.key === 'orders' || m.key === 'inventory',
    can_add: m.key === 'orders',
    can_edit: m.key === 'orders',
  }));

/** Add/Edit imply View; turning View off clears Add/Edit. */
export function togglePerm(rows: PermRow[], key: ModuleKey, field: 'can_view' | 'can_add' | 'can_edit', value: boolean): PermRow[] {
  return rows.map((r) => {
    if (r.module_key !== key) return r;
    const next = { ...r, [field]: value };
    if (field !== 'can_view' && value) next.can_view = true;
    if (field === 'can_view' && !value) { next.can_add = false; next.can_edit = false; }
    return next;
  });
}

export function summarize(rows: PermRow[]): string {
  const parts = rows.filter((r) => r.can_view).map((r) => {
    const label = MODULES.find((m) => m.key === r.module_key)?.label ?? r.module_key;
    const a = ['View', r.can_add && 'Add', r.can_edit && 'Edit'].filter(Boolean).join('/');
    return `${label} (${a})`;
  });
  return parts.length ? parts.join(', ') : 'No module access';
}

export function PermissionMatrix({ value, onChange, disabled }: { value: PermRow[]; onChange: (v: PermRow[]) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled}
          onClick={() => onChange(value.map((r) => ({ ...r, can_view: true })))}>Select all View</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled}
          onClick={() => onChange(roleDefaultPerms())}>Reset to role defaults</Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled}
          onClick={() => onChange(emptyPerms())}>Clear all</Button>
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Module</th>
              <th className="p-2 font-medium w-16">View</th>
              <th className="p-2 font-medium w-16">Add</th>
              <th className="p-2 font-medium w-16">Edit</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => {
              const r = value.find((x) => x.module_key === m.key)!;
              return (
                <tr key={m.key} className="border-t">
                  <td className="p-2">{m.label}</td>
                  {(['can_view', 'can_add', 'can_edit'] as const).map((f) => (
                    <td key={f} className="p-2 text-center">
                      <Checkbox
                        aria-label={`${m.label} ${f.replace('can_', '')}`}
                        checked={r[f]}
                        disabled={disabled}
                        onCheckedChange={(c) => onChange(togglePerm(value, m.key, f, c === true))}
                        className="h-5 w-5"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Delete is always Admin-only and cannot be granted.</p>
    </div>
  );
}
