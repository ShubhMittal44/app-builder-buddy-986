import { useState, useMemo } from "react";
import { useOtherEntries, OtherEntry } from "@/hooks/useStaffManagement";
import { useDateFilters, filterSuffix } from "@/hooks/useDateFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingStates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TransactionFilters, SummaryStrip } from "@/components/staff-management/TransactionFilters";
import { Plus, Pencil, Trash2, Search, FileDown } from "lucide-react";
import { exportOtherEntries } from "@/utils/exportStaffCSV";
import { useDebounce } from "@/hooks/useDebounce";

const formatINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function OtherTab({ defaultDate }: { defaultDate: string }) {
  const { filters, update: updateFilter, clear: clearFilters, hasFilters } = useDateFilters();
  const [serviceSearch, setServiceSearch] = useState("");
  const debouncedService = useDebounce(serviceSearch, 400);
  const { entries, loading, create, update, remove } = useOtherEntries(filters, debouncedService);

  const [dialog, setDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<OtherEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState("");
  const [formService, setFormService] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formNotes, setFormNotes] = useState("");

  const totalAmount = useMemo(() => entries.reduce((s, e) => s + Number(e.amount), 0), [entries]);

  const openAdd = () => { setEditEntry(null); setFormDate(defaultDate); setFormService(""); setFormAmount(0); setFormNotes(""); setDialog(true); };
  const openEdit = (e: OtherEntry) => { setEditEntry(e); setFormDate(e.entry_date); setFormService(e.service); setFormAmount(Number(e.amount)); setFormNotes(e.notes ?? ""); setDialog(true); };
  const save = async () => {
    const ok = editEntry
      ? await update(editEntry.id, { entry_date: formDate, service: formService, amount: formAmount, notes: formNotes || null })
      : await create({ entry_date: formDate, service: formService, amount: formAmount, notes: formNotes || null });
    if (ok) setDialog(false);
  };

  const handleClearAll = () => { clearFilters(); setServiceSearch(""); };
  const isAnyFilter = hasFilters || serviceSearch !== "";

  const handleExport = () => exportOtherEntries(entries, filterSuffix(filters));

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Other Entries</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
              <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          <TransactionFilters filters={filters} onUpdate={updateFilter} onClear={handleClearAll} hasFilters={isAnyFilter}>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Service</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search service..." value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} className="pl-7 h-8 text-xs w-40" />
              </div>
            </div>
          </TransactionFilters>
          <SummaryStrip label="Total Misc Amount" total={totalAmount} count={entries.length} formatINR={formatINR} />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries</TableCell></TableRow>
              ) : entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.entry_date}</TableCell>
                  <TableCell className="font-medium">{e.service}</TableCell>
                  <TableCell>{formatINR(Number(e.amount))}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editEntry ? "Edit Entry" : "Add Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date *</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
            <div><Label>Service *</Label><Input value={formService} onChange={e => setFormService(e.target.value)} /></div>
            <div><Label>Amount *</Label><CurrencyInput value={formAmount} onChange={setFormAmount} /></div>
            <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={save} disabled={!formDate || !formService || formAmount <= 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId) { await remove(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
