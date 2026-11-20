import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { canRequestLedgerSummary } from '@/utils/ledgerSummaryAccess';
import { filterCashTransactions, type CashCategory, type CashTransaction, type CashFilters } from '@/utils/incomeExpenses';

export function useIncomeExpenses(filters: CashFilters) {
  const { user, profile, loading: authLoading, can } = useAuth();
  const permitted = !!user && profile?.user_id === user.id && can('income_expenses', 'view');
  const [records, setRecords] = useState<{ userId: string; transactions: CashTransaction[]; categories: CashCategory[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const refetch = useCallback(async () => {
    const current = ++generation.current;
    if (!permitted || !user) { setRecords(null); setLoading(false); return; }
    setLoading(true);
    try {
      const categories: CashCategory[] = [], transactions: CashTransaction[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('income_expense_categories').select('*').order('id').range(offset, offset + 999);
        if (error) throw error;
        categories.push(...data);
        if (data.length < 1000) break;
      }
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('income_expense_transactions').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (error) throw error;
        transactions.push(...data);
        if (data.length < 1000) break;
      }
      if (current === generation.current) { setRecords({ userId: user.id, transactions, categories: categories.sort((a,b) => a.name.localeCompare(b.name)) }); setRevision(r => r + 1); }
    } catch (error) { if (current === generation.current) { setRecords(null); toast.error(error instanceof Error ? error.message : 'Unable to load transactions'); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [permitted, user?.id]);
  useEffect(() => { void refetch(); return () => { generation.current++; }; }, [refetch]);
  const transactions = permitted && records?.userId === user?.id ? records.transactions : [];
  const categories = permitted && records?.userId === user?.id ? records.categories : [];
  const filtered = useMemo(() => filterCashTransactions(transactions, categories, filters), [transactions, categories, filters]);
  const admin = canRequestLedgerSummary({ userId: user?.id, profileUserId: profile?.user_id, role: profile?.role, active: profile?.is_active, loading: authLoading });
  const key = JSON.stringify([user?.id, filters, revision]);
  const [summaryResult, setSummary] = useState<{ key: string; data: { totalIncome: number; totalExpenses: number; netCashFlow: number } } | null>(null);
  useEffect(() => {
    setSummary(null);
    if (!admin || loading) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_income_expense_summary', { date_from: filters.from || undefined, date_to: filters.to || undefined, type_filter: filters.type === 'all' ? undefined : filters.type, category_ids: filters.categories.length ? filters.categories : undefined, search_text: filters.search.trim() });
      if (!cancelled) { if (error) toast.error('Unable to load financial summary'); else if (data) setSummary({ key, data: data as { totalIncome: number; totalExpenses: number; netCashFlow: number } }); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [admin, loading, key]);
  return { transactions, categories, filtered, loading, refetch, admin, summary: admin && !loading && summaryResult?.key === key ? summaryResult.data : null };
}