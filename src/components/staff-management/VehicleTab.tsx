import { useState, useMemo } from "react";
import { useVehicles, useVehicleTransactions, Vehicle, VehicleTransaction } from "@/hooks/useStaffManagement";
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
import { Plus, Pencil, Trash2, Search, FileDown, IndianRupee } from "lucide-react";
import { exportVehicles, exportVehicleTransactions } from "@/utils/exportStaffCSV";
import { format } from "date-fns";

const formatINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function VehicleTab({ defaultDate }: { defaultDate: string }) {
  const { vehicles, loading, create, update, remove } = useVehicles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { transactions, loading: txLoading, create: createTx, update: updateTx, remove: removeTx } = useVehicleTransactions(selectedId);
  const [search, setSearch] = useState("");

  const [vDialog, setVDialog] = useState(false);
  const [editV, setEditV] = useState<Vehicle | null>(null);
  const [deleteVId, setDeleteVId] = useState<string | null>(null);
  const [txDialog, setTxDialog] = useState(false);
  const [editTx, setEditTx] = useState<VehicleTransaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);

  const [formNumber, setFormNumber] = useState("");
  const [formType, setFormType] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [txAmount, setTxAmount] = useState(0);
  const [txReason, setTxReason] = useState("");
  const [txNotes, setTxNotes] = useState("");

  const filtered = useMemo(() => {
    if (!search) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(v => v.vehicle_number.toLowerCase().includes(q) || v.vehicle_type.toLowerCase().includes(q));
  }, [vehicles, search]);

  const selectedVehicle = vehicles.find(v => v.id === selectedId);
  const totalAmount = useMemo(() => transactions.reduce((s, t) => s + Number(t.amount), 0), [transactions]);

  const openAddV = () => { setEditV(null); setFormNumber(""); setFormType(""); setFormActive(true); setFormNotes(""); setVDialog(true); };
  const openEditV = (v: Vehicle) => { setEditV(v); setFormNumber(v.vehicle_number); setFormType(v.vehicle_type); setFormActive(v.active); setFormNotes(v.notes ?? ""); setVDialog(true); };
  const saveV = async () => {
    const ok = editV
      ? await update(editV.id, { vehicle_number: formNumber, vehicle_type: formType, active: formActive, notes: formNotes || null })
      : await create({ vehicle_number: formNumber, vehicle_type: formType, active: formActive, notes: formNotes || null });
    if (ok) setVDialog(false);
  };

  const openAddTx = () => { setEditTx(null); setTxDate(defaultDate); setTxAmount(0); setTxReason(""); setTxNotes(""); setTxDialog(true); };
  const openEditTx = (t: VehicleTransaction) => { setEditTx(t); setTxDate(t.entry_date); setTxAmount(Number(t.amount)); setTxReason(t.reason); setTxNotes(t.notes ?? ""); setTxDialog(true); };
  const saveTx = async () => {
    const ok = editTx
      ? await updateTx(editTx.id, { entry_date: txDate, amount: txAmount, reason: txReason, notes: txNotes || null })
      : await createTx({ entry_date: txDate, amount: txAmount, reason: txReason, notes: txNotes || null });
    if (ok) setTxDialog(false);
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* LEFT: Vehicles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Vehicles</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportVehicles(filtered)}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
              <Button size="sm" onClick={openAddV}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search vehicles..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No vehicles</TableCell></TableRow>
              ) : filtered.map(v => (
                <TableRow key={v.id} className={`cursor-pointer ${selectedId === v.id ? 'bg-muted' : ''}`} onClick={() => setSelectedId(v.id)}>
                  <TableCell className="font-medium font-mono">{v.vehicle_number}</TableCell>
                  <TableCell>{v.vehicle_type}</TableCell>
                  <TableCell>{v.active ? "✅" : "❌"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEditV(v); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeleteVId(v.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* RIGHT: Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {selectedVehicle ? `${selectedVehicle.vehicle_number} — Transactions` : "Select a vehicle"}
            </CardTitle>
            {selectedVehicle && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportVehicleTransactions(transactions.map(t => ({ ...t, vehicle_number: selectedVehicle.vehicle_number })))}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
                <Button size="sm" onClick={openAddTx}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
            )}
          </div>
          {selectedVehicle && (
            <div className="flex gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Total: <strong>{formatINR(totalAmount)}</strong></div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!selectedVehicle ? (
            <div className="text-center text-muted-foreground py-12">Click a vehicle to view transactions</div>
          ) : txLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                ) : transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.entry_date}</TableCell>
                    <TableCell>{formatINR(Number(t.amount))}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{t.reason}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{t.notes ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditTx(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTxId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Dialog */}
      <Dialog open={vDialog} onOpenChange={setVDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editV ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vehicle Number *</Label><Input value={formNumber} onChange={e => setFormNumber(e.target.value)} /></div>
            <div><Label>Vehicle Type *</Label><Input value={formType} onChange={e => setFormType(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} id="v-active" />
              <Label htmlFor="v-active">Active</Label>
            </div>
            <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVDialog(false)}>Cancel</Button>
            <Button onClick={saveV} disabled={!formNumber || !formType}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tx Dialog */}
      <Dialog open={txDialog} onOpenChange={setTxDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date *</Label><Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} /></div>
            <div><Label>Amount *</Label><CurrencyInput value={txAmount} onChange={setTxAmount} /></div>
            <div><Label>Reason *</Label><Input value={txReason} onChange={e => setTxReason(e.target.value)} /></div>
            <div><Label>Notes</Label><Textarea value={txNotes} onChange={e => setTxNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialog(false)}>Cancel</Button>
            <Button onClick={saveTx} disabled={!txDate || txAmount <= 0 || !txReason}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete vehicle confirm */}
      <AlertDialog open={!!deleteVId} onOpenChange={() => setDeleteVId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all transactions for this vehicle.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteVId) { await remove(deleteVId); if (selectedId === deleteVId) setSelectedId(null); setDeleteVId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete tx confirm */}
      <AlertDialog open={!!deleteTxId} onOpenChange={() => setDeleteTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteTxId) { await removeTx(deleteTxId); setDeleteTxId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
