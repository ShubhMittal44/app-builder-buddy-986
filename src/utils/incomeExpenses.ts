import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

export type CashType = 'income' | 'expense';
export interface CashCategory { id: string; name: string; type: string; is_active: boolean }
export interface CashTransaction { id: string; transaction_type: string; payment_date: string; amount: number; category_id: string; payment_mode: string | null; note: string | null; created_at: string }
export interface CashFilters { from: string; to: string; type: string; categories: string[]; search: string }
export const emptyCashFilters: CashFilters = { from: '', to: '', type: 'all', categories: [], search: '' };
export function kolkataToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function paymentDateKey(userId: string) { return `rgh-income-expenses-date:${userId}`; }
export function newCashEntry(type: CashType, defaultDate: string) {
  return { transaction_type: type, payment_date: defaultDate, amount: '', category_id: '', payment_mode: '', note: '' };
}
export function amountPaise(value: string | number): bigint {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a positive amount with up to two decimal places.');
  const [rupees, fraction = ''] = text.split('.');
  const amount = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount <= 0n || amount > 99999999999999n) throw new Error('Amount must be greater than zero and within the supported limit.');
  return amount;
}
export function normalizedAmount(value: string | number) {
  const paise = amountPaise(value);
  return `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`;
}
export const cashCurrency = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value));
export const cashDate = (value: string) => format(parseISO(value), 'dd MMM yyyy');
export function datePreset(preset: string, today = kolkataToday()) {
  const date = parseISO(today);
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') return { from: iso(subDays(date, 1)), to: iso(subDays(date, 1)) };
  if (preset === 'week') return { from: iso(startOfWeek(date, { weekStartsOn: 1 })), to: today };
  if (preset === 'month') return { from: iso(startOfMonth(date)), to: iso(endOfMonth(date)) };
  if (preset === 'last-month') { const last = subMonths(date, 1); return { from: iso(startOfMonth(last)), to: iso(endOfMonth(last)) }; }
  return { from: '', to: '' };
}
export function filterCashTransactions(rows: CashTransaction[], categories: CashCategory[], filters: CashFilters) {
  const names = new Map(categories.map(c => [c.id, c.name]));
  const search = filters.search.trim().toLowerCase();
  return rows.filter(t => (!filters.from || t.payment_date >= filters.from) && (!filters.to || t.payment_date <= filters.to)
    && (filters.type === 'all' || t.transaction_type === filters.type)
    && (!filters.categories.length || filters.categories.includes(t.category_id))
    && (!search || [names.get(t.category_id), t.note, t.payment_mode, t.transaction_type].filter(Boolean).join(' ').toLowerCase().includes(search)));
}
export function cashExportRows(rows: CashTransaction[], categories: CashCategory[]) {
  return rows.map(t => ({ 'Payment Date': cashDate(t.payment_date), 'Transaction Type': t.transaction_type === 'income' ? 'Income' : 'Expense', Category: categories.find(c => c.id === t.category_id)?.name ?? '', 'Amount (INR)': normalizedAmount(t.amount), 'Payment Mode': t.payment_mode ?? '', 'Note / Description': t.note ?? '', 'Transaction ID': t.id }));
}