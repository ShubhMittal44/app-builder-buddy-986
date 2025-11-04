import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { OnlineUsers } from "@/components/OnlineUsers";
import { NotificationSettings } from "@/components/NotificationSettings";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const Analytics = () => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  
  const isOnOrdersPage = location.pathname === '/orders' || 
                         location.pathname.startsWith('/orders/') || 
                         location.pathname === '/new';

  // Redirect non-admins
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <h1 className="text-2xl font-bold text-primary">
                RGH – Order Management
              </h1>
            </Link>
            <nav className="flex gap-3">
              {!isOnOrdersPage && (
                <Button variant="ghost" asChild>
                  <Link to="/orders">Orders</Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" asChild>
                  <Link to="/analytics">Analytics</Link>
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>
      
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm md:hidden">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-primary text-center">Analytics</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Link>
          </Button>

          {/* Page Title */}
          <div>
            <h2 className="text-3xl font-bold">Analytics & Insights</h2>
            <p className="text-muted-foreground mt-1">
              Real-time analytics and performance metrics
            </p>
          </div>

          {/* Main Analytics */}
          <AnalyticsDashboard />

          {/* Real-time Features */}
          <div className="grid md:grid-cols-2 gap-6">
            <OnlineUsers />
            <NotificationSettings />
          </div>
        </div>
      </main>
      
      <MobileBottomNav />
    </div>
  );
};

export default Analytics;
