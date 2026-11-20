import { Link } from 'react-router-dom';
import { Home, ClipboardList, Boxes, Wallet, BookOpen, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function CashModuleNavigation() {
  const { can } = useAuth();
  const modules = [
    { key:'orders' as const, label:'Orders', path:'/orders', icon:ClipboardList },
    { key:'inventory' as const, label:'Inventory', path:'/admin/inventory', icon:Boxes },
    { key:'customer_ledger' as const, label:'Customer Ledger', path:'/admin/customer-ledger', icon:Wallet },
    { key:'daybook' as const, label:'DayBook', path:'/admin/daybook', icon:BookOpen },
    { key:'income_expenses' as const, label:'Income & Expenses', path:'/income-expenses', icon:ArrowLeftRight },
  ];
  return <aside className="hidden xl:block w-56 shrink-0 border-r bg-card"><nav aria-label="Modules" className="sticky top-20 p-3 space-y-1"><Button asChild variant="ghost" className="w-full justify-start"><Link to="/"><Home className="h-4 w-4 mr-2" />Home</Link></Button>{modules.filter(m => can(m.key,'view')).map(m => <Button key={m.key} asChild variant={m.key === 'income_expenses' ? 'secondary' : 'ghost'} className="w-full justify-start"><Link to={m.path} aria-current={m.key === 'income_expenses' ? 'page' : undefined}><m.icon className="h-4 w-4 mr-2 shrink-0" />{m.label}</Link></Button>)}</nav></aside>;
}