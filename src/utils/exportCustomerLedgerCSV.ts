import type { Customer, LedgerEntry, CustomerTotals } from '@/hooks/useCustomerLedger';
import { signedAmount } from '@/hooks/useCustomerLedger';
import { salespersonName, type LedgerSalesperson } from '@/utils/ledgerSalespersons';

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
const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

export function buildCustomerListCsv(customers: Customer[], totalsByCustomer: Record<string, CustomerTotals>, salespersons: LedgerSalesperson[] = []) {
  const headers = ['Customer Name', 'Salesperson', 'Phone', 'City', 'Total Sale', 'Total Received', 'Current Balance', 'Status'];
  const rows = customers.map(c => {
    const t = totalsByCustomer[c.id] ?? { totalSale: 0, totalReceived: 0, balance: 0 };
    const status = t.balance > 0 ? 'Pending' : t.balance < 0 ? 'Advance/Extra' : 'Settled';
    return toCsvRow([c.customer_name, salespersonName(c.assigned_salesperson_id, salespersons), c.phone, c.city, t.totalSale, t.totalReceived, t.balance, status]);
  });
  return [headers.join(','), ...rows].join('\n');
}

export function exportCustomerList(customers: Customer[], totalsByCustomer: Record<string, CustomerTotals>, salespersons: LedgerSalesperson[] = [], filterName = 'All') {
  downloadCsv(buildCustomerListCsv(customers, totalsByCustomer, salespersons), `Customer_Ledger_${safe(filterName)}_${dateStr()}.csv`);
}

// Chronological ledger with running balance
export function exportCustomerStatement(customer: Customer, entries: LedgerEntry[], orderNumbers: Record<string, number>) {
  const sorted = [...entries].sort((a, b) =>
    a.entry_date === b.entry_date ? a.created_at.localeCompare(b.created_at) : a.entry_date.localeCompare(b.entry_date)
  );
  const headers = ['Date', 'Type', 'Notes', 'Sale Amount', 'Amount Received', 'Balance After Entry', 'Source', 'Order Number'];
  let running = 0;
  const rows = sorted.map(e => {
    running += signedAmount(e);
    return toCsvRow([
      e.entry_date,
      e.entry_type,
      e.notes,
      e.entry_type === 'Sale' || e.entry_type === 'Opening Balance' || e.entry_type === 'Adjustment' ? e.amount : '',
      e.entry_type === 'Amount Received' ? e.amount : '',
      running,
      e.source,
      e.order_id ? (orderNumbers[e.order_id] ?? '') : '',
    ]);
  });
  downloadCsv([headers.join(','), ...rows].join('\n'), `ledger_${safe(customer.customer_name)}_${dateStr()}.csv`);
}
