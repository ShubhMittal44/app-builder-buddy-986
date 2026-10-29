import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TransactionFilters, SummaryStrip } from "@/components/staff-management/TransactionFilters";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingStates";
import { useDateFilters, filterSuffix } from "@/hooks/useDateFilters";
import { useDebounce } from "@/hooks/useDebounce";
import { useClients, useDayBookEntries, Client, DayBookEntry } from "@/hooks/useDayBook";
import { exportDayBookCSV } from "@/utils/exportDayBookCSV";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, RotateCcw, Plus, Pencil, Trash2, FileDown, Search, X } from "lucide-react";
import { format } from "date-fns";

const LS_KEY = "daybook_default_date";

type TabKey = "daybook" | "toughened" | "rama";
const TAB_TABLE = {
  daybook: "daybook_entries",
  toughened: "toughened_diary_entries",
  rama: "rama_entries",
} as const;
const TAB_LABELS = {
  daybook: "DayBook",
  toughened: "ToughenedDiary",
  rama: "Rama",
};

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ---- Client Typeahead Component ----
function ClientTypeahead({
  value,
  onSelect,
  clients,
  onCreateClient,
}: {
  value: string;
  onSelect: (client: Client) => void;
  clients: Client[];
  onCreateClient: (name: string) => Promise<Client | null>;
}) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const selectedName = useMemo(() => {
    if (!value) return "";
    return clients.find(c => c.id === value)?.client_name ?? "";
  }, [value, clients]);

  useEffect(() => {
    if (value && !query) setQuery(selectedName);
  }, [selectedName]);

  const filtered = useMemo(() => {
    if (debouncedQuery.length < 3) return [];
    const q = debouncedQuery.toLowerCase();
    return clients.filter(c => c.client_name.toLowerCase().includes(q)).slice(0, 20);
  }, [debouncedQuery, clients]);

  const exactMatch = useMemo(() => {
    if (!debouncedQuery) return false;
    return clients.some(c => c.client_name.toLowerCase() === debouncedQuery.trim().toLowerCase());
  }, [debouncedQuery, clients]);

  const handleCreate = async () => {
    setCreating(true);
    const client = await onCreateClient(query.trim());
    setCreating(false);
    if (client) {
      onSelect(client);
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        placeholder="Type client name (min 3 chars)..."
        className="h-9"
      />
      {showDropdown && debouncedQuery.length >= 3 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
              onClick={() => { onSelect(c); setQuery(c.client_name); setShowDropdown(false); }}
            >
              {c.client_name}
            </button>
          ))}
          {filtered.length === 0 && !exactMatch && query.trim().length >= 3 && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent/10 font-medium"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating..." : `+ Add new client: "${query.trim()}"`}
            </button>
          )}
          {filtered.length === 0 && exactMatch && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No more matches</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Search Client Select (for filtering, includes "All Clients") ----
function ClientSearchSelect({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (id: string) => void;
  clients: Client[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const selectedName = useMemo(() => {
    if (!value) return "";
    return clients.find(c => c.id === value)?.client_name ?? "";
  }, [value, clients]);

  const filtered = useMemo(() => {
    if (debouncedQuery.length < 3) return [];
    const q = debouncedQuery.toLowerCase();
    return clients.filter(c => c.client_name.toLowerCase().includes(q)).slice(0, 20);
  }, [debouncedQuery, clients]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Input
          value={value ? selectedName : query}
          onChange={e => { setQuery(e.target.value); onChange(""); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="All Clients (type 3+ chars)"
          className="h-9 w-52"
        />
        {value && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onChange(""); setQuery(""); }}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {open && debouncedQuery.length >= 3 && !value && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10"
              onClick={() => { onChange(c.id); setQuery(""); setOpen(false); }}
            >
              {c.client_name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Tab Content Component ----
function DayBookTab({
  tabKey,
  defaultDate,
  clients,
  onCreateClient,
  clientMap,
}: {
  tabKey: TabKey;
  defaultDate: string;
  clients: Client[];
  onCreateClient: (name: string) => Promise<Client | null>;
  clientMap: Record<string, string>;
}) {
  const table = TAB_TABLE[tabKey];
  const label = TAB_LABELS[tabKey];

  // Search state
  const [searchClientId, setSearchClientId] = useState("");
  const [challanSearch, setChallanSearch] = useState("");
  const debouncedChallan = useDebounce(challanSearch, 400);
  const { filters, update: updateFilter, clear: clearFilters, hasFilters } = useDateFilters();

  const { entries, loading, create, update, remove } = useDayBookEntries(
    table, filters, searchClientId, debouncedChallan
  );

  // Totals
  const totals = useMemo(() => {
    let totalAmt = 0, advanceAmt = 0;
    entries.forEach(e => {
      totalAmt += Number(e.total_amount ?? 0);
      advanceAmt += Number(e.advance_amount ?? 0);
    });
    return { total: totalAmt, advance: advanceAmt, balance: totalAmt - advanceAmt, count: entries.length };
  }, [entries]);

  const { isAdmin, can } = useAuth();
  const canAdd = can('daybook', 'add');
  const canEdit = can('daybook', 'edit');

  // Entry dialog
  const [dialog, setDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<DayBookEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fDate, setFDate] = useState("");
  const [fClientId, setFClientId] = useState("");
  const [fChallan, setFChallan] = useState("");
  const [fTotal, setFTotal] = useState(0);
  const [fAdvance, setFAdvance] = useState(0);
  const [fNotes, setFNotes] = useState("");

  const openAdd = () => {
    setEditEntry(null);
    setFDate(defaultDate);
    setFClientId("");
    setFChallan("");
    setFTotal(0);
    setFAdvance(0);
    setFNotes("");
    setDialog(true);
  };

  const openEdit = (e: DayBookEntry) => {
    setEditEntry(e);
    setFDate(e.entry_date);
    setFClientId(e.client_id);
    setFChallan(e.challan_number);
    setFTotal(Number(e.total_amount ?? 0));
    setFAdvance(Number(e.advance_amount ?? 0));
    setFNotes(e.notes ?? "");
    setDialog(true);
  };

  const save = async () => {
    if (!fChallan.trim()) {
      toast({ title: "Challan number is required", variant: "destructive" });
      return;
    }
    if (!fClientId) {
      toast({ title: "Client name is required", variant: "destructive" });
      return;
    }
    const payload: any = {
      entry_date: fDate,
      client_id: fClientId,
      challan_number: fChallan.trim(),
      total_amount: fTotal || null,
      advance_amount: fAdvance || null,
      notes: fNotes || null,
    };
    const ok = editEntry
      ? await update(editEntry.id, payload)
      : await create(payload);
    if (ok) setDialog(false);
  };

  const isAnyFilter = hasFilters || searchClientId !== "" || challanSearch !== "";

  const handleClear = () => {
    clearFilters();
    setSearchClientId("");
    setChallanSearch("");
  };

  const handleExport = () => {
    const suffix = filterSuffix(filters);
    const data = entries.map(e => ({ ...e, client_name: clientMap[e.client_id] ?? "" }));
    exportDayBookCSV(data, label.toLowerCase(), suffix);
  };

  const balance = fTotal - fAdvance;

  return (
    <div className="space-y-3">
      {/* Search Panel */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Client Name</Label>
              <ClientSearchSelect value={searchClientId} onChange={setSearchClientId} clients={clients} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Challan Number</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search challan..."
                  value={challanSearch}
                  onChange={e => setChallanSearch(e.target.value)}
                  className="pl-8 h-9 w-44"
                />
              </div>
            </div>
          </div>
          <TransactionFilters filters={filters} onUpdate={updateFilter} onClear={handleClear} hasFilters={isAnyFilter} />
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="font-medium">{totals.count} entries</span>
          <span>Total: <strong className="text-primary">{formatINR(totals.total)}</strong></span>
          <span>Advance: <strong className="text-accent">{formatINR(totals.advance)}</strong></span>
          <span>Balance: <strong className="text-destructive">{formatINR(totals.balance)}</strong></span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
          {canAdd && <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add Entry</Button>}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No entries found.</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Challan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => {
                const t = Number(e.total_amount ?? 0);
                const a = Number(e.advance_amount ?? 0);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                    <TableCell>{clientMap[e.client_id] ?? "—"}</TableCell>
                    <TableCell className="font-mono">{e.challan_number}</TableCell>
                    <TableCell className="text-right">{t ? formatINR(t) : "—"}</TableCell>
                    <TableCell className="text-right">{a ? formatINR(a) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(t - a)}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-muted-foreground">{e.notes ?? ""}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>}
                        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(e.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client Name *</Label>
              <ClientTypeahead
                value={fClientId}
                onSelect={c => setFClientId(c.id)}
                clients={clients}
                onCreateClient={onCreateClient}
              />
            </div>
            <div>
              <Label>Challan Number *</Label>
              <Input value={fChallan} onChange={e => setFChallan(e.target.value)} placeholder="Challan number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total Amount (₹)</Label>
                <CurrencyInput value={fTotal} onChange={setFTotal} />
              </div>
              <div>
                <Label>Advance (₹)</Label>
                <CurrencyInput value={fAdvance} onChange={setFAdvance} />
              </div>
            </div>
            <div className="text-sm">
              Balance: <strong className={balance >= 0 ? "text-primary" : "text-destructive"}>{formatINR(balance)}</strong>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={save}>{editEntry ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId) { await remove(deleteId); setDeleteId(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Main DayBook Page ----
const DayBook = () => {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("daybook");

  // Default date
  const [defaultDate, setDefaultDate] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved || format(new Date(), "yyyy-MM-dd");
  });
  useEffect(() => { localStorage.setItem(LS_KEY, defaultDate); }, [defaultDate]);

  // Clients (shared)
  const { clients, create: createClient } = useClients();
  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => { m[c.id] = c.client_name; });
    return m;
  }, [clients]);

  const handleCreateClient = useCallback(async (name: string) => {
    const c = await createClient(name);
    return c;
  }, [createClient]);

  if (!can('daybook', 'view')) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <h1 className="text-2xl font-bold text-primary">DayBook</h1>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm md:hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-lg font-bold text-primary">DayBook</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Default Date */}
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-card">
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium">Default Date</Label>
            <Input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setDefaultDate(format(new Date(), "yyyy-MM-dd"))}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset to Today
          </Button>
          <span className="text-xs text-muted-foreground">New entries will use this date by default.</span>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daybook">DayBook</TabsTrigger>
            <TabsTrigger value="toughened">ToughenedDiary</TabsTrigger>
            <TabsTrigger value="rama">Rama</TabsTrigger>
          </TabsList>
          {(["daybook", "toughened", "rama"] as TabKey[]).map(tab => (
            <TabsContent key={tab} value={tab}>
              <DayBookTab
                tabKey={tab}
                defaultDate={defaultDate}
                clients={clients}
                onCreateClient={handleCreateClient}
                clientMap={clientMap}
              />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default DayBook;
