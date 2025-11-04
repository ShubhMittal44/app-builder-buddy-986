import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Plus, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageBadge, OrderStage } from "@/components/ui/stage-badge";
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
import { mockOrders } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";

const Orders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isLoading] = useState(false);

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage =
      stageFilter === "all" || order.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

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
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="assign">Assign Site</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="dispatch">Dispatch</SelectItem>
                    <SelectItem value="fitting">Fitting</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <FileDown className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
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
                        <TableHead className="font-mono">Order No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        <TableHead className="text-right">Freight</TableHead>
                        <TableHead className="text-right font-semibold">
                          Balance
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            (window.location.href = `/orders/${order.id}`)
                          }
                        >
                          <TableCell>
                            <StageBadge stage={order.stage} />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.customerName}
                          </TableCell>
                          <TableCell>{order.city || "—"}</TableCell>
                          <TableCell>{formatDate(order.orderDate)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.advanceAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.freightAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(order.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
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
                <span className="font-medium">{mockOrders.length}</span> orders
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
    </div>
  );
};

export default Orders;
