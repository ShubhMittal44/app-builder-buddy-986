import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Plus, Download, FileText, Pencil, Trash2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingStates";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useCustomerDetail, LedgerEntry, EntryType, signedAmount } from "@/hooks/useCustomerLedger";
import { exportCustomerStatement } from "@/utils/exportCustomerLedgerCSV";
import { printCustomerStatement } from "@/utils/customerStatementPdf";

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN");
const today = () => new Date().toISOString().split("T")[0];
const PAYMENT_MODES = ["Cash", "UPI", "Bank", "Cheque", "Other"];

type FormMode = "Sale" | "Amount Received" | "OpeningAdjustment";

const CustomerLedgerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, can } = useAuth();
  const canAdd = can('customer_ledger', 'add');
  const canEdit = can('customer_ledger', 'edit');
  const { customer, entries, orderNumbers, totals, loading, createEntry, updateEntry, deleteEntry } = useCustomerDetail(id);

  // filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [newestFirst, setNewestFirst] = useState(true);

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("Sale");
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [fEntryType, setFEntryType] = useState<EntryType>("Sale");
  const [fDate, setFDate] = useState(today());
  const [fAmount, setFAmount] = useState(0);
  const [fPaymentMode, setFPaymentMode] = useState<string>("");
  const [fNotes, setFNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null);

  // chronological with running balance
  const chronological = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.entry_date === b.entry_date ? a.created_at.localeCompare(b.created_at) : a.entry_date.localeCompare(b.entry_date)
    );
    let running = 0;
    return sorted.map((e) => { running += signedAmount(e); return { entry: e, balanceAfter: running }; });
  }, [entries]);

  const filtered = useMemo(() => {
    let rows = chronological.filter(({ entry: e }) => {
      if (fromDate && e.entry_date < fromDate) return false;
      if (toDate && e.entry_date > toDate) return false;
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      return true;
    });
    if (newestFirst) rows = [...rows].reverse();
    return rows;
  }, [chronological, fromDate, toDate, typeFilter, sourceFilter, newestFirst]);

  const filteredTotals = useMemo(() => {
    let sale = 0, recv = 0;
    filtered.forEach(({ entry: e }) => {
      if (e.entry_type === "Sale") sale += Number(e.amount);
      if (e.entry_type === "Amount Received") recv += Number(e.amount);
    });
    return { sale, recv };
  }, [filtered]);

  const hasFilters = !!(fromDate || toDate || typeFilter !== "all" || sourceFilter !== "all");
  const clearFilters = () => { setFromDate(""); setToDate(""); setTypeFilter("all"); setSourceFilter("all"); };

  if (!can('customer_ledger', 'view')) return null;

  const openForm = (mode: FormMode) => {
    setEditing(null);
    setFormMode(mode);
    setFEntryType(mode === "Amount Received" ? "Amount Received" : mode === "Sale" ? "Sale" : "Opening Balance");
    setFDate(today());
    setFAmount(0);
    setFPaymentMode("");
    setFNotes("");
    setDialogOpen(true);
  };

  const openEdit = (e: LedgerEntry) => {
    setEditing(e);
    setFormMode(e.entry_type === "Amount Received" ? "Amount Received" : e.entry_type === "Sale" ? "Sale" : "OpeningAdjustment");
    setFEntryType(e.entry_type);
    setFDate(e.entry_date);
    setFAmount(Number(e.amount));
    setFPaymentMode(e.payment_mode ?? "");
    setFNotes(e.notes ?? "");
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      entry_date: fDate,
      entry_type: fEntryType,
      amount: fAmount,
      payment_mode: fEntryType === "Amount Received" ? (fPaymentMode || null) : null,
      notes: fNotes.trim() || null,
    };
    const ok = editing ? await updateEntry(editing.id, payload) : await createEntry(payload);
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteEntry(deleteTarget.id);
    setDeleteTarget(null);
  };

  const balanceText = (bal: number) =>
    bal > 0 ? `${fmt(bal)} Pending` : bal < 0 ? `${fmt(bal)} Advance` : "Settled";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!customer) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Customer not found.</p>
      <Button asChild><Link to="/admin/customer-ledger">Back to Ledger</Link></Button>
    </div>
  );

  const allowAmountSign = fEntryType === "Opening Balance" || fEntryType === "Adjustment";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/admin/customer-ledger"><ArrowLeft className="w-5 h-5" /></Link></Button>
          <h1 className="text-lg md:text-xl font-bold text-primary truncate">{customer.customer_name}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Customer card */}
        <Card>
          <CardContent className="p-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">{customer.customer_name}</h2>
              {customer.phone && <p className="text-sm text-muted-foreground">📞 {customer.phone}</p>}
              {customer.address && <p className="text-sm text-muted-foreground">📍 {customer.address}</p>}
              {customer.city && <p className="text-sm text-muted-foreground">🏙️ {customer.city}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3 self-start">
              <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground">Total Sale</p><p className="font-bold">{fmt(totals.totalSale)}</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-xs text-muted-foreground">Received</p><p className="font-bold">{fmt(totals.totalReceived)}</p></div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`font-bold ${totals.balance > 0 ? "text-destructive" : totals.balance < 0 ? "text-accent" : ""}`}>{balanceText(totals.balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {canAdd && <Button onClick={() => openForm("Sale")}><Plus className="w-4 h-4 mr-1" />Add Sale</Button>}
          {canAdd && <Button variant="secondary" onClick={() => openForm("Amount Received")}><Plus className="w-4 h-4 mr-1" />Add Amount Received</Button>}
          {canAdd && <Button variant="secondary" onClick={() => openForm("OpeningAdjustment")}><Plus className="w-4 h-4 mr-1" />Opening / Adjustment</Button>}
          <Button variant="outline" onClick={() => exportCustomerStatement(customer, filtered.map(f => f.entry), orderNumbers)}><Download className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" onClick={() => printCustomerStatement(customer, filtered.map(f => f.entry), orderNumbers, { from: fromDate, to: toDate })}><FileText className="w-4 h-4 mr-1" />PDF Statement</Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-5">
            <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Sale">Sale</SelectItem>
                  <SelectItem value="Amount Received">Amount Received</SelectItem>
                  <SelectItem value="Opening Balance">Opening Balance</SelectItem>
                  <SelectItem value="Adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewestFirst((v) => !v)}>{newestFirst ? "Newest" : "Oldest"} first</Button>
              {hasFilters && <Button variant="ghost" size="icon" onClick={clearFilters}><X className="w-4 h-4" /></Button>}
            </div>
          </CardContent>
        </Card>

        {/* Ledger table */}
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details / Notes</TableHead>
                <TableHead className="text-right">Sale</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No entries.</TableCell></TableRow>
              ) : filtered.map(({ entry: e, balanceAfter }) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                  <TableCell>{e.entry_type}</TableCell>
                  <TableCell className="max-w-xs">
                    <span className="whitespace-pre-wrap">{e.notes ?? "—"}</span>
                    {e.order_id && <div className="text-xs text-muted-foreground mt-0.5">Linked to Order #{orderNumbers[e.order_id] ?? "—"}</div>}
                    {e.payment_mode && <div className="text-xs text-muted-foreground">via {e.payment_mode}</div>}
                  </TableCell>
                  <TableCell className="text-right">{e.entry_type === "Amount Received" ? "" : fmt(Number(e.amount))}</TableCell>
                  <TableCell className="text-right">{e.entry_type === "Amount Received" ? fmt(Number(e.amount)) : ""}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{balanceText(balanceAfter)}</TableCell>
                  <TableCell>{e.source === "order" ? <Badge variant="outline">Order</Badge> : <Badge variant="secondary">Manual</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {e.source === "order" ? (
                      <span className="inline-flex items-center text-xs text-muted-foreground"><Lock className="w-3 h-3 mr-1" />Locked</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>}
                        {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="flex justify-end gap-6 p-4 text-sm border-t">
              <span>Sale: <strong>{fmt(filteredTotals.sale)}</strong></span>
              <span>Received: <strong>{fmt(filteredTotals.recv)}</strong></span>
            </div>
          )}
        </Card>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No entries.</CardContent></Card>
          ) : filtered.map(({ entry: e, balanceAfter }) => (
            <Card key={e.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{e.entry_type}</p>
                    <p className="text-xs text-muted-foreground">{e.entry_date}</p>
                  </div>
                  <span className={`font-bold ${e.entry_type === "Amount Received" ? "text-accent" : ""}`}>
                    {e.entry_type === "Amount Received" ? "- " : "+ "}{fmt(Number(e.amount))}
                  </span>
                </div>
                {e.notes && <p className="text-sm whitespace-pre-wrap">{e.notes}</p>}
                {e.order_id && <p className="text-xs text-muted-foreground">Linked to Order #{orderNumbers[e.order_id] ?? "—"}</p>}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs">Balance: {balanceText(balanceAfter)}</span>
                  {e.source === "order" ? (
                    <span className="inline-flex items-center text-xs text-muted-foreground"><Lock className="w-3 h-3 mr-1" />Locked</span>
                  ) : (
                    <div className="flex gap-1">
                      {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>}
                      {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Entry" : formMode === "Sale" ? "Add Sale" : formMode === "Amount Received" ? "Add Amount Received" : "Opening Balance / Adjustment"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(formMode === "OpeningAdjustment") && (
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={fEntryType} onValueChange={(v) => setFEntryType(v as EntryType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Opening Balance">Opening Balance</SelectItem>
                    <SelectItem value="Adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Amount {allowAmountSign && <span className="text-xs text-muted-foreground">(use negative to reduce balance)</span>}</Label>
              {allowAmountSign ? (
                <Input type="number" value={fAmount} onChange={(e) => setFAmount(Number(e.target.value))} />
              ) : (
                <CurrencyInput value={fAmount} onChange={setFAmount} />
              )}
            </div>
            {fEntryType === "Amount Received" && (
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={fPaymentMode} onValueChange={setFPaymentMode}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || (!allowAmountSign && fAmount <= 0)}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>This manual entry will be permanently removed.</AlertDialogDescription>
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

export default CustomerLedgerDetail;
