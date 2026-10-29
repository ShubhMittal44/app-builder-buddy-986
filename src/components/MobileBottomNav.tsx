import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Plus, LogOut, Boxes, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const MobileBottomNav = () => {
  const location = useLocation();
  const { signOut, can } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    ...(can("orders", "view") ? [{ icon: ClipboardList, label: "Orders", path: "/orders" }] : []),
    ...(can("orders", "add") ? [{ icon: Plus, label: "Add", path: "/new" }] : []),
    ...(can("inventory", "view") ? [{ icon: Boxes, label: "Stock", path: "/admin/inventory" }] : []),
    ...(can("customer_ledger", "view") ? [{ icon: Wallet, label: "Ledger", path: "/admin/customer-ledger" }] : []),
  ];



  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))` }}>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};
