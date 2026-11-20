import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PaymentDatePicker } from './PaymentDatePicker';
import { newCashEntry, normalizedAmount, type CashCategory, type CashTransaction, type CashType } from '@/utils/incomeExpenses';

export function CashEntryDialog({ type, transaction, defaultDate, categories, onClose, onSaved }: { type: CashType; transaction?: CashTransaction; defaultDate: string; categories: CashCategory[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(transaction ? { transaction_type: transaction.transaction_type as CashType, payment_date: transaction.payment_date, amount: String(transaction.amount), category_id: transaction.category_id, payment_mode: transaction.payment_mode ?? '', note: transaction.note ?? '' } : newCashEntry(type, defaultDate));
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const options = categories.filter(c => c.type === form.transaction_type && (c.is_active || c.id === transaction?.category_id));
  const save = async () => {
    if (lock.current) return;
    try {
      const amount = normalizedAmount(form.amount);
      if (!form.payment_date || !form.category_id) throw new Error('Payment Date and Category are required.');
      lock.current = true; setSaving(true);
      const payload = { ...form, amount: Number(amount), payment_mode: form.payment_mode || null, note: form.note.trim() || null };
      const result = transaction
        ? await supabase.from('income_expense_transactions').update(payload).eq('id', transaction.id).select('id').single()
        : await supabase.from('income_expense_transactions').insert({ ...payload, id: requestId.current }).select('id').single();
      if (result.error) throw result.error;
      toast.success('Transaction saved'); await onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Unable to save transaction'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{transaction ? 'Edit Transaction' : type === 'income' ? 'Add Income' : 'Add Expense'}</DialogTitle></DialogHeader>
    <div className="space-y-4">
      <div className="space-y-1"><Label>Transaction Type</Label><Select value={form.transaction_type} onValueChange={(v: CashType) => setForm({ ...form, transaction_type: v, category_id: '' })} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div>
      <div className="space-y-1"><Label>Payment Date *</Label><div><PaymentDatePicker label="Payment Date" value={form.payment_date} onChange={v => setForm({ ...form, payment_date: v })} /></div></div>
      <div className="space-y-1"><Label htmlFor="cash-amount">Amount (₹) *</Label><Input id="cash-amount" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} disabled={saving} /></div>
      <div className="space-y-1"><Label>Category *</Label><Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })} disabled={saving}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{options.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{!c.is_active ? ' (Inactive)' : ''}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Payment Mode</Label><Select value={form.payment_mode || 'blank'} onValueChange={v => setForm({ ...form, payment_mode: v === 'blank' ? '' : v })} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">—</SelectItem>{['Cash','UPI','Bank Transfer','Cheque','Other'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label htmlFor="cash-note">Note / Description</Label><Textarea id="cash-note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} disabled={saving} /></div>
    </div><DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Transaction'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}