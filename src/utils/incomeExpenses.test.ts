/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { amountPaise, normalizedAmount, newCashEntry, kolkataToday, paymentDateKey, filterCashTransactions, cashExportRows, datePreset, emptyCashFilters, type CashTransaction, type CashCategory } from './incomeExpenses';
import { canRequestLedgerSummary } from './ledgerSummaryAccess';
import { emptyPerms, roleDefaultPerms, togglePerm } from '@/components/users/PermissionMatrix';

const categories: CashCategory[] = [{ id:'labour',name:'Labour Charges',type:'expense',is_active:true },{ id:'fuel',name:'Fuel / Petrol',type:'expense',is_active:true },{ id:'freight',name:'Freight / Transportation',type:'expense',is_active:true },{ id:'customer',name:'Customer Payments',type:'income',is_active:true }];
const row = (id: string, category: string, amount: number, type='expense', date='2026-11-18'): CashTransaction => ({ id,category_id:category,amount,transaction_type:type,payment_date:date,payment_mode:null,note:null,created_at:'' });
const rows = [row('1','labour',5000),row('2','fuel',2000),row('3','freight',3000),row('4','customer',50000,'income')];
const sum = (data: CashTransaction[]) => data.reduce((total,t) => total + amountPaise(t.amount),0n);
test('three new entries default to 18 November without changing the default', () => {
  const date='2026-11-18'; const first=newCashEntry('expense',date); first.payment_date='2026-11-19';
  expect(newCashEntry('expense',date).payment_date).toBe('2026-11-18');
  expect(newCashEntry('income',date).payment_date).toBe('2026-11-18');
  expect(newCashEntry('expense',date).payment_date).toBe('2026-11-18');
});
test('payment date uses Kolkata timezone and independent account storage', () => {
  expect(kolkataToday(new Date('2026-11-19T20:00:00Z'))).toBe('2026-11-20');
  expect(paymentDateKey('manager')).not.toBe(paymentDateKey('staff'));
});
test('5000 expense accepts blank optional payment mode and note', () => {
  const form={...newCashEntry('expense','2026-11-18'),amount:'5000',category_id:'labour'};
  expect(normalizedAmount(form.amount)).toBe('5000.00'); expect(form.payment_mode).toBe(''); expect(form.note).toBe('');
});
test('amount is positive with paise precision and rejects negative or excessive decimals', () => {
  expect(amountPaise('0.01')).toBe(1n); expect(normalizedAmount('5000.25')).toBe('5000.25');
  for (const value of ['0','-1','2.345','NaN','Infinity']) expect(() => amountPaise(value)).toThrow();
});
test('category rename changes history display but not amounts or references', () => {
  const renamed=categories.map(c => c.id==='labour' ? {...c,name:'Machinery Maintenance',is_active:false} : c);
  expect(cashExportRows(rows,renamed)[0].Category).toBe('Machinery Maintenance');
  expect(rows[0].category_id).toBe('labour'); expect(rows[0].amount).toBe(5000);
});
test('50000 income minus 15000 expenses equals 35000 exactly', () => {
  const income=amountPaise('50000'), expense=amountPaise('15000'); expect(income-expense).toBe(3500000n);
});
test('Labour filter yields 5000 expenses and negative 5000 net flow', () => {
  const filtered=filterCashTransactions(rows,categories,{...emptyCashFilters,categories:['labour']});
  expect(filtered.map(t=>t.id)).toEqual(['1']); expect(sum(filtered)).toBe(500000n);
  expect(filtered.reduce((total,t)=>total+(t.transaction_type==='income'?amountPaise(t.amount):-amountPaise(t.amount)),0n)).toBe(-500000n);
});
test('three expense categories total 10000', () => {
  expect(sum(filterCashTransactions(rows,categories,{...emptyCashFilters,categories:['labour','fuel','freight']}))).toBe(1000000n);
});
test('date, category, type and search filters combine without changing stored data', () => {
  const data=[...rows,row('old','labour',300,'expense','2026-10-01')];
  expect(filterCashTransactions(data,categories,{from:'2026-11-01',to:'2026-11-20',type:'expense',categories:['labour'],search:'Labour'}).map(t=>t.id)).toEqual(['1']);
  expect(data).toHaveLength(5); expect(datePreset('last-month','2026-11-20')).toEqual({from:'2026-10-01',to:'2026-10-31'});
});
for (const role of ['manager','staff']) test(`${role} full permissions never grant financial summary`, () => {
  expect(canRequestLedgerSummary({userId:'user',profileUserId:'user',role,active:true,loading:false})).toBe(false);
});
test('new user and role defaults leave Income & Expenses disabled', () => {
  for (const perms of [emptyPerms(),roleDefaultPerms()]) expect(perms.find(p=>p.module_key==='income_expenses')).toEqual({module_key:'income_expenses',can_view:false,can_add:false,can_edit:false});
  expect(togglePerm(emptyPerms(),'income_expenses','can_add',true).find(p=>p.module_key==='income_expenses')?.can_view).toBe(true);
});
test('filtered exports include all 1001 matching transactions without summary values', () => {
  const data=Array.from({length:1001},(_,i)=>row(String(i),'labour',5000));
  const exported=cashExportRows(filterCashTransactions(data,categories,{...emptyCashFilters,categories:['labour']}),categories);
  expect(exported).toHaveLength(1001); expect(exported[1000]['Amount (INR)']).toBe('5000.00');
  expect(Object.keys(exported[0])).not.toContain('Net Cash Flow');
});