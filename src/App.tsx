import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import OrderWorkspace from "./pages/OrderWorkspace";
import Install from "./pages/Install";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Users from "./pages/Users";

import StaffManagement from "./pages/StaffManagement";
import InventoryManagement from "./pages/InventoryManagement";
import CustomerLedger from "./pages/CustomerLedger";
import CustomerLedgerDetail from "./pages/CustomerLedgerDetail";
import DayBook from "./pages/DayBook";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Public routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/install" element={<Install />} />
            
            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/new" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderWorkspace /></ProtectedRoute>} />
            
            <Route path="/admin/staff-management" element={<ProtectedRoute requireAdmin><StaffManagement /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute><InventoryManagement /></ProtectedRoute>} />
            <Route path="/admin/customer-ledger" element={<ProtectedRoute requireAdmin><CustomerLedger /></ProtectedRoute>} />
            <Route path="/admin/customer-ledger/:id" element={<ProtectedRoute requireAdmin><CustomerLedgerDetail /></ProtectedRoute>} />
            <Route path="/admin/daybook" element={<ProtectedRoute requireAdmin><DayBook /></ProtectedRoute>} />
            
            {/* Admin-only routes */}
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
