/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { assignedCustomerCounts, filterLedgerCustomers, salespersonName, summarizeCustomers } from './ledgerSalespersons';
import { buildCustomerListCsv } from './exportCustomerLedgerCSV';
import { computeTotals, type Customer } from '@/hooks/useCustomerLedger';

const customer = (id: string, name: string, salesperson: string | null): Customer => ({
  id, customer_name: name, assigned_salesperson_id: salesperson,
  customer_name_norm: name.toLowerCase(), phone: null, city: null, address: null,
  notes: null, created_at: '', updated_at: '',
});
const salespersons = [{ id: 'rahul', name: 'Rahul', is_active: false }, { id: 'amit', name: 'Amit', is_active: true }];
const customers = [customer('abc', 'ABC Glass Traders', 'rahul'), customer('xyz', 'XYZ Construction', 'amit'), customer('modern', 'Modern Glass House', 'rahul'), customer('walk', 'Walk-in Customer', null)];
const totals = {
  abc: { totalSale: 50000, totalReceived: 5000, balance: 45000 },
  xyz: { totalSale: 80000, totalReceived: 8000, balance: 72000 },
  modern: { totalSale: 20000, totalReceived: 2000, balance: 18000 },
  walk: { totalSale: 8000, totalReceived: 0, balance: 8000 },
};

describe('Customer Ledger salesperson rules', () => {
  test('counts automatically follow reassignment: Rahul 2 to 1, Amit 1 to 2', () => {
    expect(assignedCustomerCounts(customers)).toEqual({ rahul: 2, amit: 1 });
    const reassigned = customers.map(c => c.id === 'modern' ? { ...c, assigned_salesperson_id: 'amit' } : c);
    expect(assignedCustomerCounts(reassigned)).toEqual({ rahul: 1, amit: 2 });
  });
  test('all includes unassigned, unassigned includes only walk-in', () => {
    expect(filterLedgerCustomers(customers, totals, '', 'all', 'all')).toHaveLength(4);
    expect(filterLedgerCustomers(customers, totals, '', 'all', 'unassigned').map(c => c.id)).toEqual(['walk']);
  });
  test('Rahul filter combines name search and balance filters', () => {
    expect(filterLedgerCustomers(customers, totals, 'Glass', 'pending', 'rahul').map(c => c.id)).toEqual(['abc', 'modern']);
    expect(filterLedgerCustomers(customers, totals, 'Glass', 'settled', 'rahul')).toEqual([]);
  });
  test('Rahul summary uses only assigned balances: 45000 + 18000', () => {
    expect(summarizeCustomers(filterLedgerCustomers(customers, totals, '', 'all', 'rahul'), totals)).toEqual({ totalCustomers: 2, totalSale: 70000, totalReceived: 7000, outstanding: 63000 });
  });
  test('Amit CSV excludes Rahul and unassigned and preserves financial figures', () => {
    const csv = buildCustomerListCsv(filterLedgerCustomers(customers, totals, '', 'all', 'amit'), totals, salespersons);
    expect(csv).toContain('XYZ Construction,Amit,,,80000,8000,72000,Pending');
    expect(csv).not.toContain('ABC Glass Traders');
    expect(csv).not.toContain('Walk-in Customer');
  });
  test('inactive names remain visible and missing assignments are Unassigned', () => {
    expect(salespersonName('rahul', salespersons)).toBe('Rahul');
    expect(salespersonName(null, salespersons)).toBe('Unassigned');
  });
  test('reassignment leaves the existing sale/payment calculations intact', () => {
    const entries = [{ entry_type: 'Sale', amount: 50000 }, { entry_type: 'Amount Received', amount: 5000 }] as Parameters<typeof computeTotals>[0];
    const before = computeTotals(entries);
    const reassigned = { ...customers[0], assigned_salesperson_id: 'amit' };
    expect(reassigned.assigned_salesperson_id).toBe('amit');
    expect(computeTotals(entries)).toEqual(before);
    expect(before.balance).toBe(45000);
  });
  test('four assigned customers show count 4 and removing one updates it', () => {
    const four = [customer('1', 'A', 'rahul'), customer('2', 'B', 'rahul'), customer('3', 'C', 'rahul'), customer('4', 'D', 'rahul')];
    expect(assignedCustomerCounts(four).rahul).toBe(4);
    expect(assignedCustomerCounts(four.slice(1)).rahul).toBe(3);
  });
  test('new salesperson has no manually maintained count', () => {
    expect(assignedCustomerCounts(customers)['sandeep'] ?? 0).toBe(0);
  });
});