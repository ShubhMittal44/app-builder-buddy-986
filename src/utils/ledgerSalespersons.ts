import type { Customer, CustomerTotals } from '@/hooks/useCustomerLedger';

export interface LedgerSalesperson {
  id: string;
  name: string;
  is_active: boolean;
}

export function salespersonName(id: string | null | undefined, salespersons: LedgerSalesperson[]) {
  return salespersons.find(s => s.id === id)?.name ?? 'Unassigned';
}

export function assignedCustomerCounts(customers: Customer[]) {
  const counts: Record<string, number> = {};
  customers.forEach(c => {
    if (c.assigned_salesperson_id) counts[c.assigned_salesperson_id] = (counts[c.assigned_salesperson_id] ?? 0) + 1;
  });
  return counts;
}

export function filterLedgerCustomers(customers: Customer[], totals: Record<string, CustomerTotals>, search: string, balanceFilter: string, salespersonFilter: string) {
  const q = search.trim().toLowerCase();
  return customers.filter(c => {
    if (salespersonFilter === 'unassigned' && c.assigned_salesperson_id) return false;
    if (salespersonFilter !== 'all' && salespersonFilter !== 'unassigned' && c.assigned_salesperson_id !== salespersonFilter) return false;
    if (q && !`${c.customer_name} ${c.phone ?? ''} ${c.city ?? ''}`.toLowerCase().includes(q)) return false;
    const balance = totals[c.id]?.balance ?? 0;
    const status = balance > 0 ? 'pending' : balance < 0 ? 'advance' : 'settled';
    return balanceFilter === 'all' || balanceFilter === status;
  });
}

export function summarizeCustomers(customers: Customer[], totals: Record<string, CustomerTotals>) {
  return customers.reduce((sum, c) => {
    const t = totals[c.id];
    sum.totalSale += t?.totalSale ?? 0;
    sum.totalReceived += t?.totalReceived ?? 0;
    sum.outstanding += t?.balance ?? 0;
    return sum;
  }, { totalCustomers: customers.length, totalSale: 0, totalReceived: 0, outstanding: 0 });
}