import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Plus, Briefcase, BookOpen, LogOut, Boxes } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const MobileBottomNav = () => {
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: ClipboardList, label: "Orders", path: "/orders" },
    { icon: Plus, label: "Add", path: "/new" },
    
    ...(isAdmin ? [{ icon: Briefcase, label: "Staff", path: "/admin/staff-management" }] : []),
    ...(isAdmin ? [{ icon: Boxes, label: "Stock", path: "/admin/inventory" }] : []),
    ...(isAdmin ? [{ icon: BookOpen, label: "DayBook", path: "/admin/daybook" }] : []),
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
      <div className={cn(
        "grid h-16",
        isAdmin ? "grid-cols-6" : "grid-cols-4"
      )}>
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
