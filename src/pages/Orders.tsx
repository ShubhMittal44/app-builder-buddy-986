import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Filter, Plus, FileDown, ArrowUpDown } from "lucide-react";
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
import { LoadingSpinner } from "@/components/LoadingStates";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useDebounce } from "@/hooks/useDebounce";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useOrders, OrderStage } from "@/hooks/useOrders";

type SortField = "orderNumber" | "customerName" | "city" | "orderDate" | "totalAmount" | "balance";
type SortDirection = "asc" | "desc";

const Orders = () => {
  const navigate = useNavigate();
  const { orders, loading, error } = useOrders();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OrderStage | "all">("all");
  const [sortField, setSortField] = useState<SortField>("orderDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
          const aBalance = (a.total_amount || 0) - (a.advance_amount || 0) + (a.freight_amount || 0);
          const bBalance = (b.total_amount || 0) - (b.advance_amount || 0) + (b.freight_amount || 0);
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
  }, [orders, debouncedSearchQuery, stageFilter, sortField, sortDirection]);

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
        navigate(`/orders/${filteredOrders[selectedRowIndex].id}`);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <h1 className="text-2xl font-bold text-primary">
                RGH – Order Management
              </h1>
            </Link>
            <nav className="flex gap-3">
              <Button variant="ghost" asChild>
                <Link to="/">Orders</Link>
              </Button>
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
                <Button variant="outline" aria-label="Export data">
                  <FileDown className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  <p className="text-muted-foreground text-center mb-4">
                    {searchQuery || stageFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first order"}
                  </p>
                  <Button asChild>
                    <Link to="/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Order
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
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
                        <TableHead className="text-right">Freight</TableHead>
                        <TableHead className="text-right font-semibold">
                          <button
                            onClick={() => handleSort("balance")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            Balance
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order, index) => {
                        const balance = (order.total_amount || 0) - (order.advance_amount || 0) + (order.freight_amount || 0);
                        return (
                          <TableRow
                            key={order.id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              selectedRowIndex === index ? "bg-muted" : ""
                            }`}
                            onClick={() => navigate(`/orders/${order.id}`)}
                            tabIndex={0}
                            role="button"
                            aria-label={`View order ${order.order_number}`}
                          >
                            <TableCell>
                              <StageBadge stage={order.stage} />
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
                            <TableCell className="text-right">
                              {formatCurrency(order.freight_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(balance)}
                            </TableCell>
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
      
      <OfflineIndicator />
    </div>
  );
};

export default Orders;
