import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/stage-badge";
import { Package, ClipboardList, Truck, Wrench, CheckCircle, LogOut, Users as UsersIcon, Briefcase, BookOpen, Boxes, Wallet } from "lucide-react";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const Index = () => {
  const { isAdmin, signOut } = useAuth();
  const location = useLocation();
  
  // Hide Orders link on desktop when on orders pages
  const isOnOrdersPage = location.pathname === '/orders' || 
                         location.pathname.startsWith('/orders/') || 
                         location.pathname === '/new';

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="border-b bg-card hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">RGH – Order Management</h1>
            <nav className="flex gap-4">
              {!isOnOrdersPage && (
                <Button variant="ghost" asChild>
                  <Link to="/orders">Orders</Link>
                </Button>
              )}
              <Button asChild>
                <Link to="/new">Add Order</Link>
              </Button>
              {isAdmin && (
                <Button variant="ghost" asChild>
                  <Link to="/admin/staff-management">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Staff Mgmt
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" asChild>
                  <Link to="/admin/inventory">
                    <Boxes className="w-4 h-4 mr-2" />
                    Inventory
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" asChild>
                  <Link to="/admin/daybook">
                    <BookOpen className="w-4 h-4 mr-2" />
                    DayBook
                  </Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" asChild>
                  <Link to="/admin/users">
                    <UsersIcon className="w-4 h-4 mr-2" />
                    Users
                  </Link>
                </Button>
              )}
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Mobile Header */}
      <header className="border-b bg-card md:hidden sticky top-0 z-40">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-primary text-center">RGH Order Management</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">Welcome to RGH Order Management</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline your glass installation orders from intake to completion with our
              powerful workflow management system.
            </p>
          </div>

          {/* Admin Quick Actions */}
          {isAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Button asChild variant="default" className="h-auto py-4 flex-col gap-2">
                <Link to="/admin/inventory">
                  <Boxes className="w-6 h-6" />
                  <span>Inventory</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto py-4 flex-col gap-2">
                <Link to="/orders">
                  <ClipboardList className="w-6 h-6" />
                  <span>Orders</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto py-4 flex-col gap-2">
                <Link to="/admin/staff-management">
                  <Briefcase className="w-6 h-6" />
                  <span>Staff Mgmt</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto py-4 flex-col gap-2">
                <Link to="/admin/daybook">
                  <BookOpen className="w-6 h-6" />
                  <span>DayBook</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto py-4 flex-col gap-2">
                <Link to="/admin/users">
                  <UsersIcon className="w-6 h-6" />
                  <span>Users</span>
                </Link>
              </Button>
            </div>
          )}


          {/* Workflow Stages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Order Workflow Stages</CardTitle>
              <CardDescription>
                Track orders through six distinct stages with clear visual indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Package className="w-8 h-8 text-stage-intake" />
                  <div>
                    <StageBadge stage="intake" />
                    <p className="text-sm text-muted-foreground mt-1">Initial order intake</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <ClipboardList className="w-8 h-8 text-stage-assign" />
                  <div>
                    <StageBadge stage="assign_site" />
                    <p className="text-sm text-muted-foreground mt-1">Assign to site</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Package className="w-8 h-8 text-stage-processing" />
                  <div>
                    <StageBadge stage="processing" />
                    <p className="text-sm text-muted-foreground mt-1">Order processing</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Truck className="w-8 h-8 text-stage-dispatch" />
                  <div>
                    <StageBadge stage="dispatch" />
                    <p className="text-sm text-muted-foreground mt-1">Ready for dispatch</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Wrench className="w-8 h-8 text-stage-fitting" />
                  <div>
                    <StageBadge stage="fitting" />
                    <p className="text-sm text-muted-foreground mt-1">Installation phase</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <CheckCircle className="w-8 h-8 text-stage-closed" />
                  <div>
                    <StageBadge stage="closed" />
                    <p className="text-sm text-muted-foreground mt-1">Order completed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  Unified Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Single-table architecture with all order and customer data in one place
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <ClipboardList className="w-5 h-5 text-accent" />
                  </div>
                  Real-time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track order progress with automatic timeline logging and status updates
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  Workflow Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Stage-specific requirements ensure proper order progression
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
      
      <MobileBottomNav />
      <PWAInstallPrompt />
    </div>
  );
};

export default Index;
