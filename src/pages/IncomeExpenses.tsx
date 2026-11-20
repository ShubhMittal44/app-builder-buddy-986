import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Tags, Search, Pencil, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { LoadingSpinner } from '@/components/LoadingStates';
import { PaymentDatePicker } from '@/components/income-expenses/PaymentDatePicker';
import { CashEntryDialog } from '@/components/income-expenses/CashEntryDialog';
import { CashCategoriesDialog } from '@/components/income-expenses/CashCategoriesDialog';
import { CashModuleNavigation } from '@/components/income-expenses/CashModuleNavigation';
import { useIncomeExpenses } from '@/hooks/useIncomeExpenses';
import { kolkataToday, paymentDateKey, emptyCashFilters, datePreset, cashCurrency, cashDate, cashExportRows, type CashTransaction, type CashType } from '@/utils/incomeExpenses';

export default function IncomeExpenses() {
  const { user, can } = useAuth();
  const [defaultDate, setDefaultDate] = useState(kolkataToday);
  useEffect(() => { if (user) setDefaultDate(sessionStorage.getItem(paymentDateKey(user.id)) || kolkataToday()); }, [user?.id]);
  const changeDefault = (date: string) => { setDefaultDate(date); if (user) sessionStorage.setItem(paymentDateKey(user.id), date); };
  const [filters, setFilters] = useState(emptyCashFilters);
  const [preset, setPreset] = useState('all');
  const ledger = useIncomeExpenses(filters);
  const [entry, setEntry] = useState<{ type: CashType; transaction?: CashTransaction } | null>(null);
  const [manage, setManage] = useState(false), [page, setPage] = useState(0), [ascending, setAscending] = useState(false);
  const [deleting, setDeleting] = useState<CashTransaction | null>(null), [busy, setBusy] = useState(false);
  const canAdd = can('income_expenses','add'), canEdit = can('income_expenses','edit');
  useEffect(() => { setPage(0); }, [filters, ascending]);
  const pages = Math.max(1, Math.ceil(ledger.filtered.length / 25));
  const currentPage = Math.min(page,pages - 1);
  const rows = (ascending ? [...ledger.filtered].reverse() : ledger.filtered).slice(currentPage * 25, currentPage * 25 + 25);
  const exportFile = (extension: 'csv' | 'xlsx') => {
    const sheet = XLSX.utils.json_to_sheet(cashExportRows(ledger.filtered, ledger.categories));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Transactions');
    XLSX.writeFile(book, `Income_Expenses_${filters.from || 'All'}_${filters.to || 'Dates'}.${extension}`, { bookType: extension });
  };
  const deleteEntry = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    const { error } = await supabase.from('income_expense_transactions').delete().eq('id',deleting.id).select('id').single();
    if (error) toast.error(error.message); else { setDeleting(null); toast.success('Transaction deleted'); await ledger.refetch(); }
    setBusy(false);
  };
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
    <header className="border-b bg-card sticky top-0 z-40"><div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3"><h1 className="text-lg md:text-2xl font-bold text-primary">Income & Expenses</h1><Button variant="ghost" size="sm" asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Home</Link></Button></div></header>
    <div className="flex"><CashModuleNavigation /><main className="container min-w-0 mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3"><Label>Default Payment Date</Label><PaymentDatePicker label="Default Payment Date" value={defaultDate} onChange={changeDefault} /></div>
      {ledger.admin && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[{ label:'Total Income',value:ledger.summary?.totalIncome,icon:TrendingUp,color:'text-accent' },{ label:'Total Expenses',value:ledger.summary?.totalExpenses,icon:TrendingDown,color:'text-destructive' },{ label:'Net Cash Flow',value:ledger.summary?.netCashFlow,icon:Wallet,color:'text-primary' }].map(s => <Card key={s.label}><CardContent className="p-4 flex gap-3 items-center"><s.icon className={`h-5 w-5 shrink-0 ${s.color}`} /><div className="min-w-0"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold break-words">{s.value === undefined ? '…' : cashCurrency(s.value)}</p></div></CardContent></Card>)}</div>}
      <div className="flex flex-wrap gap-2">{canAdd && <><Button onClick={() => setEntry({ type:'income' })}><Plus className="mr-2 h-4 w-4" />Add Income</Button><Button variant="outline" onClick={() => setEntry({ type:'expense' })}><Plus className="mr-2 h-4 w-4" />Add Expense</Button></>}{(canAdd || canEdit || ledger.admin) && <Button variant="outline" onClick={() => setManage(true)}><Tags className="mr-2 h-4 w-4" />Manage Categories</Button>}<Button variant="outline" disabled={ledger.loading} onClick={() => exportFile('xlsx')}><Download className="mr-2 h-4 w-4" />Excel</Button><Button variant="outline" disabled={ledger.loading} onClick={() => exportFile('csv')}><Download className="mr-2 h-4 w-4" />CSV</Button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1"><Label>Date Range</Label><Select value={preset} onValueChange={v => { setPreset(v); if (v !== 'custom') setFilters({ ...filters,...datePreset(v) }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['all','All Dates'],['today','Today'],['yesterday','Yesterday'],['week','This Week'],['month','This Month'],['last-month','Last Month'],['custom','Custom Date Range']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Transaction Type</Label><Select value={filters.type} onValueChange={type => setFilters({ ...filters,type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Transactions</SelectItem><SelectItem value="income">Income Only</SelectItem><SelectItem value="expense">Expenses Only</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label>Categories</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between"><Tags className="h-4 w-4" />{filters.categories.length ? `${filters.categories.length} selected` : 'All Categories'}</Button></PopoverTrigger><PopoverContent className="max-h-80 overflow-y-auto space-y-2"><Button variant="ghost" size="sm" onClick={() => setFilters({ ...filters,categories:[] })}>All Categories</Button>{ledger.categories.map(c => <label key={c.id} className="flex items-start gap-2 text-sm"><Checkbox checked={filters.categories.includes(c.id)} onCheckedChange={checked => setFilters({ ...filters,categories:checked ? [...filters.categories,c.id] : filters.categories.filter(id => id !== c.id) })} /><span>{c.name} <span className="text-muted-foreground">({c.type})</span></span></label>)}</PopoverContent></Popover></div>
        <div className="space-y-1"><Label htmlFor="cash-search">Search</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="cash-search" className="pl-9" value={filters.search} onChange={e => setFilters({ ...filters,search:e.target.value })} placeholder="Category, note, payment mode…" /></div></div>
      </div>
      {preset === 'custom' && <div className="flex flex-wrap gap-3"><div className="space-y-1"><Label>From</Label><div><PaymentDatePicker label="From date" value={filters.from} onChange={from => setFilters({ ...filters,from })} /></div></div><div className="space-y-1"><Label>To</Label><div><PaymentDatePicker label="To date" value={filters.to} onChange={to => setFilters({ ...filters,to })} /></div></div></div>}
      {filters.from && filters.to && filters.from > filters.to && <p className="text-sm text-destructive">From date must be on or before To date.</p>}
      {ledger.loading ? <div className="flex justify-center py-16"><LoadingSpinner /></div> : <div className="border rounded-md bg-card overflow-x-auto"><Table><TableHeader><TableRow><TableHead><Button variant="ghost" size="sm" onClick={() => setAscending(!ascending)}>Date {ascending ? '↑' : '↓'}</Button></TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Payment Mode</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map(t => <TableRow key={t.id}><TableCell className="whitespace-nowrap">{cashDate(t.payment_date)}</TableCell><TableCell className={t.transaction_type === 'income' ? 'text-accent' : 'text-destructive'}>{t.transaction_type === 'income' ? 'Income' : 'Expense'}</TableCell><TableCell>{ledger.categories.find(c => c.id === t.category_id)?.name ?? '—'}</TableCell><TableCell className="text-right whitespace-nowrap font-mono">{cashCurrency(t.amount)}</TableCell><TableCell>{t.payment_mode || '—'}</TableCell><TableCell className="min-w-32 max-w-xs break-words">{t.note || '—'}</TableCell><TableCell><div className="flex justify-end">{canEdit && <Button variant="ghost" size="icon" title="Edit transaction" onClick={() => setEntry({ type:t.transaction_type as CashType,transaction:t })}><Pencil className="h-4 w-4" /></Button>}{ledger.admin && <Button variant="ghost" size="icon" title="Delete transaction" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No transactions found.</TableCell></TableRow>}</TableBody></Table></div>}
      <div className="flex justify-between items-center gap-2 text-sm"><span>{ledger.filtered.length} transactions · Page {currentPage + 1} of {pages}</span><div className="flex gap-1"><Button variant="outline" size="icon" title="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" title="Next page" disabled={currentPage+1 >= pages} onClick={() => setPage(currentPage+1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </main></div>
    {entry && <CashEntryDialog key={entry.transaction?.id || entry.type} {...entry} defaultDate={defaultDate} categories={ledger.categories} onClose={() => setEntry(null)} onSaved={ledger.refetch} />}
    {manage && <CashCategoriesDialog categories={ledger.categories} canAdd={canAdd} canEdit={canEdit} admin={ledger.admin} onClose={() => setManage(false)} onSaved={ledger.refetch} />}
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete transaction?</AlertDialogTitle><AlertDialogDescription>This permanently removes the transaction and retains its deletion audit record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void deleteEntry(); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <MobileBottomNav />
  </div>;
}