import { useState, useMemo } from "react";
import { useStaffMembers, useStaffTransactions, StaffMember, StaffTransaction, StaffType } from "@/hooks/useStaffManagement";
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
import { Plus, Pencil, Trash2, Search, FileDown, IndianRupee } from "lucide-react";
import { exportStaffMembers, exportStaffTransactions } from "@/utils/exportStaffCSV";

const formatINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function StaffTab({ defaultDate }: { defaultDate: string }) {
  const { members, loading, create, update, remove } = useStaffMembers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { filters, update: updateFilter, clear: clearFilters, hasFilters } = useDateFilters();
  const { transactions, loading: txLoading, create: createTx, update: updateTx, remove: removeTx } = useStaffTransactions(selectedId, filters);
  const [search, setSearch] = useState("");

  const [memberDialog, setMemberDialog] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [txDialog, setTxDialog] = useState(false);
  const [editTx, setEditTx] = useState<StaffTransaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSalary, setFormSalary] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formType, setFormType] = useState<StaffType | "">("");
  const [txDate, setTxDate] = useState("");
  const [txAmount, setTxAmount] = useState(0);
  const [txNotes, setTxNotes] = useState("");

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.staff_name.toLowerCase().includes(q));
  }, [members, search]);

  const selectedMember = members.find(m => m.id === selectedId);
  const totalMoneyTaken = useMemo(() => transactions.reduce((s, t) => s + Number(t.money_taken), 0), [transactions]);

  const openAddMember = () => { setEditMember(null); setFormName(""); setFormSalary(0); setFormActive(true); setFormNotes(""); setFormType(""); setMemberDialog(true); };
  const openEditMember = (m: StaffMember) => { setEditMember(m); setFormName(m.staff_name); setFormSalary(m.monthly_salary); setFormActive(m.active); setFormNotes(m.notes ?? ""); setFormType(m.staff_type ?? ""); setMemberDialog(true); };
  const saveMember = async () => {
    const ok = editMember
      ? await update(editMember.id, { staff_name: formName, monthly_salary: formSalary, active: formActive, notes: formNotes || null, staff_type: formType || null })
      : await create({ staff_name: formName, monthly_salary: formSalary, active: formActive, notes: formNotes || null, staff_type: formType || null });
    if (ok) setMemberDialog(false);
  };

  const openAddTx = () => { setEditTx(null); setTxDate(defaultDate); setTxAmount(0); setTxNotes(""); setTxDialog(true); };
  const openEditTx = (t: StaffTransaction) => { setEditTx(t); setTxDate(t.entry_date); setTxAmount(Number(t.money_taken)); setTxNotes(t.notes ?? ""); setTxDialog(true); };
  const saveTx = async () => {
    const ok = editTx
      ? await updateTx(editTx.id, { entry_date: txDate, money_taken: txAmount, notes: txNotes || null })
      : await createTx({ entry_date: txDate, money_taken: txAmount, notes: txNotes || null });
    if (ok) setTxDialog(false);
  };

  const handleExportMembers = () => exportStaffMembers(filtered);
  const handleExportTx = () => {
    const data = transactions.map(t => ({ ...t, staff_name: selectedMember?.staff_name ?? "" }));
    exportStaffTransactions(data, filterSuffix(filters));
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* LEFT: Staff Members */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Staff Members</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportMembers}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
              <Button size="sm" onClick={openAddMember}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No staff members</TableCell></TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id} className={`cursor-pointer ${selectedId === m.id ? 'bg-muted' : ''}`} onClick={() => setSelectedId(m.id)}>
                  <TableCell className="font-medium">{m.staff_name}</TableCell>
                  <TableCell className="text-xs">{m.staff_type ?? "—"}</TableCell>
                  <TableCell>{formatINR(m.monthly_salary)}</TableCell>
                  <TableCell>{m.active ? "✅" : "❌"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEditMember(m); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeleteMemberId(m.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
              {selectedMember ? `${selectedMember.staff_name} — Transactions` : "Select a staff member"}
            </CardTitle>
            {selectedMember && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportTx}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
                <Button size="sm" onClick={openAddTx}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
            )}
          </div>
          {selectedMember && (
            <div className="flex gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Salary: <strong>{formatINR(selectedMember.monthly_salary)}</strong></div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 px-3 pb-3">
          {!selectedMember ? (
            <div className="text-center text-muted-foreground py-12">Click a staff member to view transactions</div>
          ) : (
            <>
              <TransactionFilters filters={filters} onUpdate={updateFilter} onClear={clearFilters} hasFilters={hasFilters} />
              <SummaryStrip label="Total Money Taken" total={totalMoneyTaken} count={transactions.length} formatINR={formatINR} />
              {txLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Money Taken</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                    ) : transactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>{t.entry_date}</TableCell>
                        <TableCell>{formatINR(Number(t.money_taken))}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{t.notes ?? "—"}</TableCell>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Member Dialog */}
      <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMember ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div><Label>Monthly Salary *</Label><CurrencyInput value={formSalary} onChange={setFormSalary} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} id="staff-active" />
              <Label htmlFor="staff-active">Active</Label>
            </div>
            <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialog(false)}>Cancel</Button>
            <Button onClick={saveMember} disabled={!formName || formSalary <= 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tx Dialog */}
      <Dialog open={txDialog} onOpenChange={setTxDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date *</Label><Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} /></div>
            <div><Label>Money Taken *</Label><CurrencyInput value={txAmount} onChange={setTxAmount} /></div>
            <div><Label>Notes</Label><Textarea value={txNotes} onChange={e => setTxNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialog(false)}>Cancel</Button>
            <Button onClick={saveTx} disabled={!txDate || txAmount <= 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete member confirm */}
      <AlertDialog open={!!deleteMemberId} onOpenChange={() => setDeleteMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all their transactions. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteMemberId) { await remove(deleteMemberId); if (selectedId === deleteMemberId) setSelectedId(null); setDeleteMemberId(null); } }}>Delete</AlertDialogAction>
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
