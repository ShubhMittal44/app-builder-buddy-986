import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Filter, Plus, FileDown, ArrowUpDown, Download, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageBadge } from "@/components/ui/stage-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingStates";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useDebounce } from "@/hooks/useDebounce";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useOrders, OrderStage } from "@/hooks/useOrders";
import { useNotifications } from "@/hooks/useNotifications";
import { exportToCSV } from "@/utils/exportOrders";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useChalanPDF } from "@/hooks/useChalanPDF";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SortField = "orderNumber" | "customerName" | "city" | "orderDate" | "totalAmount" | "balance";
type SortDirection = "asc" | "desc";

const Orders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { orders, loading, error, refetch } = useOrders();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { notifyNewOrder } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OrderStage | "all">("all");
  const orderTypeParam = searchParams.get("order_type");
  const orderTypeFilter: "all" | "Daybook" | "Toughened" =
    orderTypeParam === "Daybook" || orderTypeParam === "Toughened" ? orderTypeParam : "all";
  const setOrderTypeFilter = (value: "all" | "Daybook" | "Toughened") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "all") next.delete("order_type");
      else next.set("order_type", value);
      return next;
    });
  };
  const [sortField, setSortField] = useState<SortField>("orderDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewOrderNumber, setPreviewOrderNumber] = useState<number>(0);
  const [previewOrderId, setPreviewOrderId] = useState<string>('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string>('');
  const [deleteOrderNumber, setDeleteOrderNumber] = useState<number>(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkCloseDialog, setShowBulkCloseDialog] = useState(false);
  const [isBulkClosing, setIsBulkClosing] = useState(false);
  
  const { generatePDF, loading: pdfLoading } = useChalanPDF();
  const [notesPdfLoading, setNotesPdfLoading] = useState(false);

  const handleDownloadNotesPdf = async () => {
    setNotesPdfLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Auth required', description: 'You must be logged in', variant: 'destructive' });
        return;
      }
      const resp = await fetch(
        `https://cqyqjjhfwfydgusavlng.supabase.co/functions/v1/open-orders-notes-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeXFqamhmd2Z5ZGd1c2F2bG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODUwNDQsImV4cCI6MjA3Nzg2MTA0NH0.piJ3BXC8gy4TArxcT8M5fAH_6AZs1HhusjFtYdqWrYQ',
          },
          body: '{}',
        }
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RGH_Open_Orders_Notes_Chalan_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: 'Notes PDF downloaded' });
    } catch (err: any) {
      console.error('Notes PDF error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setNotesPdfLoading(false);
    }
  };
  
  const isOnOrdersPage = location.pathname === '/orders' || 
                         location.pathname.startsWith('/orders/') || 
                         location.pathname === '/new';
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Notify on new orders (real-time)
  useEffect(() => {
    const previousCount = orders.length;
    return () => {
      if (orders.length > previousCount) {
        const newOrder = orders[0]; // Newest order
        notifyNewOrder(newOrder.order_number, newOrder.customer_name);
      }
    };
  }, [orders.length]);

  const handleExport = () => {
    exportToCSV(filteredOrders, `orders-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.order_number.toString().includes(query) ||
          order.customer_name.toLowerCase().includes(query) ||
          order.city?.toLowerCase().includes(query) ||
          order.address?.toLowerCase().includes(query) ||
          order.phone?.toLowerCase().includes(query)
      );
    }

    // Apply stage filter
    if (stageFilter !== "all") {
      filtered = filtered.filter((order) => order.stage === stageFilter);
    }

    // Apply order type filter
    if (orderTypeFilter !== "all") {
      filtered = filtered.filter(
        (order) => ((order as any).order_type || "Daybook") === orderTypeFilter
      );
    }

    // Sort orders
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case "orderNumber":
          aValue = a.order_number;
          bValue = b.order_number;
          break;
        case "customerName":
          aValue = a.customer_name;
          bValue = b.customer_name;
          break;
        case "city":
          aValue = a.city || "";
          bValue = b.city || "";
          break;
        case "orderDate":
          aValue = new Date(a.order_date).getTime();
          bValue = new Date(b.order_date).getTime();
          break;
        case "totalAmount":
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case "balance":
          const aBalance = (a.total_amount || 0) - (a.advance_amount || 0);
          const bBalance = (b.total_amount || 0) - (b.advance_amount || 0);
          aValue = aBalance;
          bValue = bBalance;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [orders, debouncedSearchQuery, stageFilter, orderTypeFilter, sortField, sortDirection]);

  const allFilteredSelected = useMemo(
    () => selectedIds.size > 0 && filteredOrders.every(o => selectedIds.has(o.id)),
    [selectedIds, filteredOrders]
  );
  const someFilteredSelected = useMemo(
    () => selectedIds.size > 0 && filteredOrders.some(o => selectedIds.has(o.id)) && !allFilteredSelected,
    [selectedIds, filteredOrders, allFilteredSelected]
  );

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        filteredOrders.forEach(o => next.add(o.id));
      } else {
        filteredOrders.forEach(o => next.delete(o.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Auth required', description: 'You must be logged in', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('admin-bulk-delete-orders', {
        body: { ids: Array.from(selectedIds) },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        // Fallback to direct fetch if needed
        const resp = await fetch(`https://cqyqjjhfwfydgusavlng.supabase.co/functions/v1/admin-bulk-delete-orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });
        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          throw new Error(errJson.error || `Bulk delete failed (${resp.status})`);
        }
      }
      toast({ title: 'Selected orders deleted successfully.', description: `Deleted ${Array.from(selectedIds).length} order(s).` });
      clearSelection();
      refetch();
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      toast({ title: 'Bulk delete failed', description: err.message || 'Failed to delete orders', variant: 'destructive' });
    }
  };

  const handleBulkClose = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Auth required', description: 'You must be logged in', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('bulk-close-orders', {
        body: { order_ids: Array.from(selectedIds) },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      const result = data as { closed_count?: number; already_closed_count?: number };
      const closed = result?.closed_count ?? 0;
      const already = result?.already_closed_count ?? 0;
      toast({
        title: 'Selected orders closed successfully.',
        description: already > 0
          ? `Closed ${closed} order(s). ${already} were already closed.`
          : `Closed ${closed} order(s).`,
      });
      clearSelection();
      refetch();
    } catch (err: any) {
      console.error('Bulk close error:', err);
      toast({ title: 'Bulk close failed', description: err.message || 'Failed to close orders', variant: 'destructive' });
    }
  };



  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Keyboard navigation
  useKeyboardNavigation(
    () => setSelectedRowIndex((prev) => Math.max(-1, prev - 1)),
    () => setSelectedRowIndex((prev) => Math.min(filteredOrders.length - 1, prev + 1)),
    () => {
      if (selectedRowIndex >= 0 && filteredOrders[selectedRowIndex]) {
        navigate(`/orders/${filteredOrders[selectedRowIndex].id}`, { state: { from: location.pathname + location.search } });
      }
    },
    () => setSelectedRowIndex(-1)
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDownloadAndView = async (e: React.MouseEvent, orderId: string, orderNumber: number) => {
    e.stopPropagation(); // Prevent row click
    
    // Generate PDF blob
    const blob = await generatePDF(orderId, false);
    if (!blob) return;
    
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    // 1. Open in modal viewer
    setPdfPreviewUrl(url);
    setPreviewOrderNumber(orderNumber);
    setPreviewOrderId(orderId);
    setShowPdfModal(true);
    
    // 2. Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `chalan_${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadFromModal = async () => {
    if (previewOrderId && pdfPreviewUrl) {
      // Trigger download from existing blob URL
      const a = document.createElement('a');
      a.href = pdfPreviewUrl;
      a.download = `chalan_${previewOrderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClosePdfModal = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setShowPdfModal(false);
    setPdfPreviewUrl(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, orderId: string, orderNumber: number) => {
    e.stopPropagation();
    setDeleteOrderId(orderId);
    setDeleteOrderNumber(orderNumber);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOrderId) return;

    setIsDeleting(true);
    try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Error",
        description: "You must be logged in to delete orders",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.functions.invoke('admin-delete-order', {
      body: { order_id: deleteOrderId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      // Surface the actual server error message when available
      let serverMsg = error.message;
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const eb = await ctx.json();
          if (eb?.error) serverMsg = eb.error;
        }
      } catch { /* ignore */ }
      throw new Error(serverMsg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);

      const result = data as any;

      toast({
        title: "Order deleted successfully.",
        description: result.message || `Order #${deleteOrderNumber} has been deleted`,
      });

      // Refresh the orders list
      refetch();
      
      // Close dialog
      setShowDeleteDialog(false);
      setDeleteOrderId('');
      setDeleteOrderNumber(0);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
              <Button asChild>
                <Link to="/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Order
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm md:hidden">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-primary text-center">Orders</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders, customers, cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Search orders"
                  />
                </div>
                <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as OrderStage | "all")}>
                  <SelectTrigger className="w-full md:w-48" aria-label="Filter by stage">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="assign_site">Assign Site</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="dispatch">Dispatch</SelectItem>
                    <SelectItem value="fitting">Fitting</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as "all" | "Daybook" | "Toughened")}>
                  <SelectTrigger className="w-full md:w-44" aria-label="Filter by order type">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Order Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Daybook">Daybook</SelectItem>
                    <SelectItem value="Toughened">Toughened</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" aria-label="Export data" onClick={handleExport}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" aria-label="Download Notes PDF" onClick={handleDownloadNotesPdf} disabled={notesPdfLoading}>
                  <FileDown className="w-4 h-4 mr-2" />
                  {notesPdfLoading ? 'Generating…' : 'Notes PDF'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bulk selection toolbar */}
          {isAdmin && selectedIds.size > 0 && (
            <Card>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{selectedIds.size}</span> selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowBulkCloseDialog(true)}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Close selected
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>Delete selected</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size="lg" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <p className="text-destructive">{error}</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                  <p className="text-muted-foreground text-center">
                    {searchQuery || stageFilter !== "all" || orderTypeFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "No orders yet"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isAdmin && (
                          <TableHead className="w-[42px]">
                            <Checkbox
                              checked={allFilteredSelected ? true : (someFilteredSelected ? 'indeterminate' as any : false)}
                              onCheckedChange={(v) => toggleSelectAllFiltered(Boolean(v))}
                              aria-label="Select all filtered"
                            />
                          </TableHead>
                        )}
                        <TableHead>Stage</TableHead>
                        <TableHead>Order Type</TableHead>
                        <TableHead className="font-mono">
                          <button
                            onClick={() => handleSort("orderNumber")}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Order No
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort("customerName")}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Customer
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort("city")}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            City
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            onClick={() => handleSort("orderDate")}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Order Date
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => handleSort("totalAmount")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            Total
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        
                        <TableHead className="text-right font-semibold">
                          <button
                            onClick={() => handleSort("balance")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            Balance
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                        <TableHead>Chalan / Glass Size</TableHead>
                        {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order, index) => {
                        const balance = (order.total_amount || 0) - (order.advance_amount || 0);
                        const orderType = ((order as any).order_type as string) || "Daybook";
                        return (
                          <TableRow
                            key={order.id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              selectedRowIndex === index ? "bg-muted" : ""
                            }`}
                            onClick={() => navigate(`/orders/${order.id}`, { state: { from: location.pathname + location.search } })}
                            tabIndex={0}
                            role="button"
                            aria-label={`View order ${order.order_number}`}
                          >
                            {isAdmin && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedIds.has(order.id)}
                                  onCheckedChange={(v) => toggleRow(order.id, Boolean(v))}
                                  aria-label={`Select order ${order.order_number}`}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <StageBadge stage={order.stage} />
                            </TableCell>
                            <TableCell>
                              <Badge variant={orderType === "Toughened" ? "default" : "secondary"}>
                                {orderType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              {order.order_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.customer_name}
                            </TableCell>
                            <TableCell>{order.city || "—"}</TableCell>
                            <TableCell>{formatDate(order.order_date)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(order.total_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(order.advance_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(balance)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {order.files && Array.isArray(order.files) && order.files.length > 0 ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleDownloadAndView(e, order.id, order.order_number)}
                                    disabled={pdfLoading}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    ({order.files.length})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleDeleteClick(e, order.id, order.order_number)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {filteredOrders.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{filteredOrders.length}</span> of{" "}
                <span className="font-medium">{orders.length}</span> orders
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      
      <PDFPreviewModal
        open={showPdfModal}
        onOpenChange={setShowPdfModal}
        pdfUrl={pdfPreviewUrl}
        orderNumber={previewOrderNumber}
        onDownload={handleDownloadFromModal}
      />
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order #{deleteOrderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order and all attached chalan images will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected orders?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {selectedIds.size} orders. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsBulkDeleting(true);
                handleBulkDelete().finally(() => {
                  setIsBulkDeleting(false);
                  setShowBulkDeleteDialog(false);
                });
              }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkCloseDialog} onOpenChange={setShowBulkCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close selected orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the selected orders as Closed immediately and skip remaining stages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkClosing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsBulkClosing(true);
                handleBulkClose().finally(() => {
                  setIsBulkClosing(false);
                  setShowBulkCloseDialog(false);
                });
              }}
              disabled={isBulkClosing}
            >
              {isBulkClosing ? "Closing..." : "Confirm Close"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      
      <MobileBottomNav />
      <OfflineIndicator />
    </div>
  );
};

export default Orders;
