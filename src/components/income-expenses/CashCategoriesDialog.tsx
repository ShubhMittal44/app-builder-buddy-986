import { useState } from 'react';
import { Pencil, Trash2, Plus, CircleCheck, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import type { CashCategory, CashType } from '@/utils/incomeExpenses';

export function CashCategoriesDialog({ categories, canAdd, canEdit, admin, onClose, onSaved }: { categories: CashCategory[]; canAdd: boolean; canEdit: boolean; admin: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<CashType>('expense'), [name, setName] = useState('');
  const [editing, setEditing] = useState<CashCategory | null>(null), [deleting, setDeleting] = useState<CashCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (busy) return false;
    setBusy(true);
    try { const { error } = await operation(); if (error) throw error; await onSaved(); return true; }
    catch (error) { toast.error((error as { message: string }).message.includes('foreign key') ? 'This category has transactions. Deactivate it instead.' : (error as { message: string }).message); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!name.trim()) return;
    const ok = await run(() => editing ? supabase.from('income_expense_categories').update({ name: name.trim() }).eq('id', editing.id).select('id').single() : supabase.from('income_expense_categories').insert({ name: name.trim(), type }));
    if (ok) { setName(''); setEditing(null); toast.success('Category saved'); }
  };
  return <><Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
    {(canAdd || editing && canEdit) && <div className="space-y-2 border-b pb-4"><Label>{editing ? 'Rename Category' : 'New Category'}</Label><div className="flex gap-2"><Input aria-label="Category name" value={name} onChange={e => setName(e.target.value)} disabled={busy} /><Button size="icon" title="Save category" onClick={save} disabled={busy || !name.trim()}><Plus className="h-4 w-4" /></Button></div>{!editing && <Select value={type} onValueChange={(v: CashType) => setType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select>}{editing && <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setName(''); }}>Cancel</Button>}</div>}
    {(['income','expense'] as const).map(group => <section key={group} className="space-y-2"><h3 className="font-semibold">{group === 'income' ? 'Income Categories' : 'Expense Categories'}</h3>{categories.filter(c => c.type === group).map(c => <div key={c.id} className="flex items-center justify-between gap-2 border-b py-2"><span className="min-w-0 break-words text-sm">{c.name}{!c.is_active && <span className="text-muted-foreground"> · Inactive</span>}</span><div className="flex shrink-0">{canEdit && <><Button variant="ghost" size="icon" title="Rename" disabled={busy} onClick={() => { setEditing(c); setName(c.name); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={c.is_active ? 'Deactivate' : 'Reactivate'} disabled={busy} onClick={() => void run(() => supabase.from('income_expense_categories').update({ is_active: !c.is_active }).eq('id',c.id))}>{c.is_active ? <Ban className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}</Button></>}{admin && <Button variant="ghost" size="icon" title="Delete category" disabled={busy} onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div>)}</section>)}
  </DialogContent></Dialog><AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete category?</AlertDialogTitle><AlertDialogDescription>{deleting?.name}. Categories with transactions cannot be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async e => { e.preventDefault(); if (deleting && await run(() => supabase.from('income_expense_categories').delete().eq('id', deleting.id))) setDeleting(null); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}