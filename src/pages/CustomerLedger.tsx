import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Plus, Search, Users as UsersIcon, Wallet, TrendingUp, TrendingDown, Eye, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingStates";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useCustomerLedger, Customer } from "@/hooks/useCustomerLedger";
import { exportCustomerList } from "@/utils/exportCustomerLedgerCSV";

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN");

type BalanceFilter = "all" | "pending" | "settled" | "advance";

const emptyForm = { customer_name: "", phone: "", address: "", city: "", notes: "" };

const CustomerLedger = () => {
  const { isAdmin, can } = useAuth();
  const canAdd = can('customer_ledger', 'add');
  const canEdit = can('customer_ledger', 'edit');
  const navigate = useNavigate();
  const { customers, loading, totalsByCustomer, grandTotals, createCustomer, updateCustomer, deleteCustomer } = useCustomerLedger();

  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const balanceStatus = (bal: number) => (bal > 0 ? "pending" : bal < 0 ? "advance" : "settled");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const t = totalsByCustomer[c.id] ?? { balance: 0 };
      if (q) {
        const hay = `${c.customer_name} ${c.phone ?? ""} ${c.city ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (balanceFilter !== "all" && balanceStatus(t.balance) !== balanceFilter) return false;
      return true;
    });
  }, [customers, search, balanceFilter, totalsByCustomer]);

  if (!can('customer_ledger', 'view')) return null;

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ customer_name: c.customer_name, phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "", notes: c.notes ?? "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.customer_name.trim()) return;
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    };
    const ok = editing ? await updateCustomer(editing.id, payload) : await createCustomer(payload);
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCustomer(deleteTarget.id);
    setDeleteTarget(null);
  };

  const BalancePill = ({ bal }: { bal: number }) => {
    if (bal > 0) return <Badge variant="destructive">{fmt(bal)} Pending</Badge>;
    if (bal < 0) return <Badge className="bg-accent text-accent-foreground hover:bg-accent">{fmt(bal)} Advance</Badge>;
    return <Badge variant="secondary">Settled</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold text-primary">Customer Ledger</h1>
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Home</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><UsersIcon className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Customers</p><p className="text-xl font-bold">{grandTotals.totalCustomers}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><TrendingUp className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Sale</p><p className="text-xl font-bold">{fmt(grandTotals.totalSale)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><TrendingDown className="w-5 h-5 text-accent" /></div>
            <div><p className="text-xs text-muted-foreground">Total Received</p><p className="text-xl font-bold">{fmt(grandTotals.totalReceived)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><Wallet className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold">{fmt(grandTotals.outstanding)}</p></div>
          </CardContent></Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name, phone, city..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCustomerList(filtered, totalsByCustomer)}>
              <Download className="w-4 h-4 mr-2" />CSV
            </Button>
            {canAdd && <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Add Customer</Button>}
          </div>
        </div>

        <Tabs value={balanceFilter} onValueChange={(v) => setBalanceFilter(v as BalanceFilter)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="settled">Settled</TabsTrigger>
            <TabsTrigger value="advance">Advance/Extra</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No customers found.</CardContent></Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Total Sale</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const t = totalsByCustomer[c.id] ?? { totalSale: 0, totalReceived: 0, balance: 0 };
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/admin/customer-ledger/${c.id}`)}>
                        <TableCell className="font-medium">{c.customer_name}</TableCell>
                        <TableCell>{c.phone ?? "—"}</TableCell>
                        <TableCell>{c.city ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmt(t.totalSale)}</TableCell>
                        <TableCell className="text-right">{fmt(t.totalReceived)}</TableCell>
                        <TableCell><BalancePill bal={t.balance} /></TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/customer-ledger/${c.id}`)}><Eye className="w-4 h-4" /></Button>
                            {canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>}
                            {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((c) => {
                const t = totalsByCustomer[c.id] ?? { totalSale: 0, totalReceived: 0, balance: 0 };
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{c.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{[c.phone, c.city].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <BalancePill bal={t.balance} />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sale {fmt(t.totalSale)}</span>
                        <span className="text-muted-foreground">Recd {fmt(t.totalReceived)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1" onClick={() => navigate(`/admin/customer-ledger/${c.id}`)}><Eye className="w-4 h-4 mr-1" />Ledger</Button>
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>}
                        {isAdmin && <Button size="sm" variant="outline" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.customer_name.trim()}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.customer_name}</strong> and all their ledger entries (including order-linked ones). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomNav />
    </div>
  );
};

export default CustomerLedger;
