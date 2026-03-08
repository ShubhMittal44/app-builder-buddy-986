import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { TransactionFilters, SummaryStrip } from "@/components/staff-management/TransactionFilters";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingStates";
import { useDateFilters, filterSuffix } from "@/hooks/useDateFilters";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useStaffMembers, useStaffTransactions, useVehicles, useVehicleTransactions, useOtherEntries, useDistinctServices,
  StaffMember, StaffTransaction, Vehicle, VehicleTransaction, OtherEntry, StaffType,
} from "@/hooks/useStaffManagement";
import { exportStaffMembers, exportStaffTransactions, exportVehicles, exportVehicleTransactions, exportOtherEntries } from "@/utils/exportStaffCSV";
import { ArrowLeft, RotateCcw, Plus, Pencil, Trash2, FileDown, Settings2, Search } from "lucide-react";
import { format } from "date-fns";

const LS_KEY = "staff_management_default_date";
type Category = "staff" | "vehicle" | "other";

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const StaffManagement = () => {
  const { isAdmin } = useAuth();

  // ---- Default Date ----
  const [defaultDate, setDefaultDate] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved || format(new Date(), "yyyy-MM-dd");
  });
  useEffect(() => { localStorage.setItem(LS_KEY, defaultDate); }, [defaultDate]);

  // ---- Global Filter State ----
  const [category, setCategory] = useState<Category>("staff");
  const [entityId, setEntityId] = useState(""); // '' = All
  const [serviceSearch, setServiceSearch] = useState("");
  const debouncedService = useDebounce(serviceSearch, 400);
  const { filters, update: updateFilter, clear: clearFilters, hasFilters } = useDateFilters();

  // Reset entity when category changes
  useEffect(() => { setEntityId(""); setServiceSearch(""); }, [category]);

  // ---- Data Hooks ----
  const { members, loading: membersLoading, create: createMember, update: updateMember, remove: removeMember, refetch: refetchMembers } = useStaffMembers();
  const { vehicles, loading: vehiclesLoading, create: createVehicle, update: updateVehicle, remove: removeVehicle, refetch: refetchVehicles } = useVehicles();
  const distinctServices = useDistinctServices();

  const { transactions: staffTx, loading: staffTxLoading, create: createStaffTx, update: updateStaffTx, remove: removeStaffTx } =
    useStaffTransactions(category === "staff" ? entityId : "__skip__", category === "staff" ? filters : undefined);

  const { transactions: vehicleTx, loading: vehicleTxLoading, create: createVehicleTx, update: updateVehicleTx, remove: removeVehicleTx } =
    useVehicleTransactions(category === "vehicle" ? entityId : "__skip__", category === "vehicle" ? filters : undefined);

  const { entries: otherEntries, loading: otherLoading, create: createOther, update: updateOther, remove: removeOther } =
    useOtherEntries(category === "other" ? filters : undefined, category === "other" ? debouncedService : undefined);

  // Filter members by staff_type
  const filteredMembers = useMemo(() => {
    if (!staffTypeFilter) return members;
    return members.filter(m => m.staff_type === staffTypeFilter);
  }, [members, staffTypeFilter]);

  // ---- Entity selector options ----
  const staffOptions = useMemo(() => [
    { value: "", label: "All Staff" },
    ...filteredMembers.map(m => ({ value: m.id, label: m.staff_name })),
  ], [filteredMembers]);

  const vehicleOptions = useMemo(() => [
    { value: "", label: "All Vehicles" },
    ...vehicles.map(v => ({ value: v.id, label: `${v.vehicle_number} (${v.vehicle_type})` })),
  ], [vehicles]);

  const serviceOptions = useMemo(() => [
    { value: "", label: "All Services" },
    ...distinctServices.map(s => ({ value: s, label: s })),
  ], [distinctServices]);

  // ---- Summary ----
  const staffTotal = useMemo(() => staffTx.reduce((s, t) => s + Number(t.money_taken), 0), [staffTx]);
  const vehicleTotal = useMemo(() => vehicleTx.reduce((s, t) => s + Number(t.amount), 0), [vehicleTx]);
  const otherTotal = useMemo(() => otherEntries.reduce((s, e) => s + Number(e.amount), 0), [otherEntries]);

  // Staff name lookup
  const staffNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    members.forEach(s => { m[s.id] = s.staff_name; });
    return m;
  }, [members]);
  const vehicleNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    vehicles.forEach(v => { m[v.id] = v.vehicle_number; });
    return m;
  }, [vehicles]);

  // ---- CRUD dialogs state ----
  // Staff transaction dialog
  const [staffTxDialog, setStaffTxDialog] = useState(false);
  const [editStaffTx, setEditStaffTx] = useState<StaffTransaction | null>(null);
  const [deleteStaffTxId, setDeleteStaffTxId] = useState<string | null>(null);
  const [stfDate, setStfDate] = useState("");
  const [stfAmount, setStfAmount] = useState(0);
  const [stfNotes, setStfNotes] = useState("");
  const [stfStaffId, setStfStaffId] = useState("");

  // Vehicle transaction dialog
  const [vehTxDialog, setVehTxDialog] = useState(false);
  const [editVehTx, setEditVehTx] = useState<VehicleTransaction | null>(null);
  const [deleteVehTxId, setDeleteVehTxId] = useState<string | null>(null);
  const [vehDate, setVehDate] = useState("");
  const [vehAmount, setVehAmount] = useState(0);
  const [vehReason, setVehReason] = useState("");
  const [vehNotes, setVehNotes] = useState("");
  const [vehVehicleId, setVehVehicleId] = useState("");

  // Other entry dialog
  const [otherDialog, setOtherDialog] = useState(false);
  const [editOther, setEditOther] = useState<OtherEntry | null>(null);
  const [deleteOtherId, setDeleteOtherId] = useState<string | null>(null);
  const [othDate, setOthDate] = useState("");
  const [othService, setOthService] = useState("");
  const [othAmount, setOthAmount] = useState(0);
  const [othNotes, setOthNotes] = useState("");

  // Entity management dialogs
  const [manageDialog, setManageDialog] = useState(false);
  const [staffMemberDialog, setStaffMemberDialog] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [mName, setMName] = useState("");
  const [mSalary, setMSalary] = useState(0);
  const [mActive, setMActive] = useState(true);
  const [mNotes, setMNotes] = useState("");
  const [mType, setMType] = useState<StaffType | "">("");
  const [staffTypeFilter, setStaffTypeFilter] = useState<StaffType | "">("");

  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [vNum, setVNum] = useState("");
  const [vType, setVType] = useState("");
  const [vActive, setVActive] = useState(true);
  const [vNotes, setVNotes] = useState("");

  // ---- CRUD handlers ----
  const openAddStaffTx = () => {
    setEditStaffTx(null); setStfDate(defaultDate); setStfAmount(0); setStfNotes("");
    setStfStaffId(entityId || (members[0]?.id ?? ""));
    setStaffTxDialog(true);
  };
  const openEditStaffTx = (t: StaffTransaction) => {
    setEditStaffTx(t); setStfDate(t.entry_date); setStfAmount(Number(t.money_taken)); setStfNotes(t.notes ?? "");
    setStfStaffId(t.staff_id); setStaffTxDialog(true);
  };
  const saveStaffTx = async () => {
    const ok = editStaffTx
      ? await updateStaffTx(editStaffTx.id, { entry_date: stfDate, money_taken: stfAmount, notes: stfNotes || null })
      : await createStaffTx({ entry_date: stfDate, money_taken: stfAmount, notes: stfNotes || null, staff_id: stfStaffId });
    if (ok) setStaffTxDialog(false);
  };

  const openAddVehTx = () => {
    setEditVehTx(null); setVehDate(defaultDate); setVehAmount(0); setVehReason(""); setVehNotes("");
    setVehVehicleId(entityId || (vehicles[0]?.id ?? ""));
    setVehTxDialog(true);
  };
  const openEditVehTx = (t: VehicleTransaction) => {
    setEditVehTx(t); setVehDate(t.entry_date); setVehAmount(Number(t.amount)); setVehReason(t.reason); setVehNotes(t.notes ?? "");
    setVehVehicleId(t.vehicle_id); setVehTxDialog(true);
  };
  const saveVehTx = async () => {
    const ok = editVehTx
      ? await updateVehicleTx(editVehTx.id, { entry_date: vehDate, amount: vehAmount, reason: vehReason, notes: vehNotes || null })
      : await createVehicleTx({ entry_date: vehDate, amount: vehAmount, reason: vehReason, notes: vehNotes || null, vehicle_id: vehVehicleId });
    if (ok) setVehTxDialog(false);
  };

  const openAddOther = () => {
    setEditOther(null); setOthDate(defaultDate); setOthService(""); setOthAmount(0); setOthNotes("");
    setOtherDialog(true);
  };
  const openEditOther = (e: OtherEntry) => {
    setEditOther(e); setOthDate(e.entry_date); setOthService(e.service); setOthAmount(Number(e.amount)); setOthNotes(e.notes ?? "");
    setOtherDialog(true);
  };
  const saveOther = async () => {
    const ok = editOther
      ? await updateOther(editOther.id, { entry_date: othDate, service: othService, amount: othAmount, notes: othNotes || null })
      : await createOther({ entry_date: othDate, service: othService, amount: othAmount, notes: othNotes || null });
    if (ok) setOtherDialog(false);
  };

  // Entity management
  const openAddMember = () => { setEditMember(null); setMName(""); setMSalary(0); setMActive(true); setMNotes(""); setMType(""); setStaffMemberDialog(true); };
  const openEditMember = (m: StaffMember) => { setEditMember(m); setMName(m.staff_name); setMSalary(m.monthly_salary); setMActive(m.active); setMNotes(m.notes ?? ""); setMType(m.staff_type ?? ""); setStaffMemberDialog(true); };
  const saveMember = async () => {
    const ok = editMember
      ? await updateMember(editMember.id, { staff_name: mName, monthly_salary: mSalary, active: mActive, notes: mNotes || null, staff_type: mType || null })
      : await createMember({ staff_name: mName, monthly_salary: mSalary, active: mActive, notes: mNotes || null, staff_type: mType || null });
    if (ok) { setStaffMemberDialog(false); refetchMembers(); }
  };

  const openAddVehicle = () => { setEditVehicle(null); setVNum(""); setVType(""); setVActive(true); setVNotes(""); setVehicleDialog(true); };
  const openEditVehicle = (v: Vehicle) => { setEditVehicle(v); setVNum(v.vehicle_number); setVType(v.vehicle_type); setVActive(v.active); setVNotes(v.notes ?? ""); setVehicleDialog(true); };
  const saveVehicle = async () => {
    const ok = editVehicle
      ? await updateVehicle(editVehicle.id, { vehicle_number: vNum, vehicle_type: vType, active: vActive, notes: vNotes || null })
      : await createVehicle({ vehicle_number: vNum, vehicle_type: vType, active: vActive, notes: vNotes || null });
    if (ok) { setVehicleDialog(false); refetchVehicles(); }
  };

  // ---- Export ----
  const handleExport = () => {
    const suffix = filterSuffix(filters);
    if (category === "staff") {
      const data = staffTx.map(t => ({ ...t, staff_name: staffNameMap[t.staff_id] ?? "" }));
      exportStaffTransactions(data, suffix);
    } else if (category === "vehicle") {
      const data = vehicleTx.map(t => ({ ...t, vehicle_number: vehicleNameMap[t.vehicle_id] ?? "" }));
      exportVehicleTransactions(data, suffix);
    } else {
      exportOtherEntries(otherEntries, suffix);
    }
  };

  const handleClearFilters = () => {
    clearFilters();
    setEntityId("");
    setServiceSearch("");
    setStaffTypeFilter("");
  };


  const isAnyFilter = hasFilters || entityId !== "" || serviceSearch !== "" || staffTypeFilter !== "";
  const isLoading = category === "staff" ? staffTxLoading : category === "vehicle" ? vehicleTxLoading : otherLoading;

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <h1 className="text-2xl font-bold text-primary">Staff Management</h1>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm md:hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-lg font-bold text-primary">Staff Management</h1>
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

        {/* Global Filter Panel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Category selector */}
            <div className="flex flex-wrap items-center gap-4">
              <Label className="text-sm font-medium">Category:</Label>
              {(["staff", "vehicle", "other"] as Category[]).map(c => (
                <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio" name="category" checked={category === c}
                    onChange={() => setCategory(c)}
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize">{c}</span>
                </label>
              ))}

              {/* Manage entities button */}
              {(category === "staff" || category === "vehicle") && (
                <Button variant="outline" size="sm" onClick={() => setManageDialog(true)} className="ml-auto">
                  <Settings2 className="w-3.5 h-3.5 mr-1" />
                  Manage {category === "staff" ? "Staff" : "Vehicles"}
                </Button>
              )}
            </div>

            {/* Entity selector */}
            <div className="flex flex-wrap items-end gap-3">
              {category === "staff" && (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <Label className="text-xs">Staff Name</Label>
                  <SearchableSelect
                    value={entityId}
                    onValueChange={v => setEntityId(v)}
                    options={staffOptions}
                    placeholder="All Staff"
                    searchPlaceholder="Search staff..."
                    className="h-9"
                  />
                </div>
              )}
              {category === "vehicle" && (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <Label className="text-xs">Vehicle</Label>
                  <SearchableSelect
                    value={entityId}
                    onValueChange={v => setEntityId(v)}
                    options={vehicleOptions}
                    placeholder="All Vehicles"
                    searchPlaceholder="Search vehicles..."
                    className="h-9"
                  />
                </div>
              )}
              {category === "other" && (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <Label className="text-xs">Service</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search service..."
                      value={serviceSearch}
                      onChange={e => setServiceSearch(e.target.value)}
                      className="pl-8 h-9 w-52"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Date filters */}
            <TransactionFilters filters={filters} onUpdate={updateFilter} onClear={handleClearFilters} hasFilters={isAnyFilter} />
          </CardContent>
        </Card>

        {/* Summary + Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {category === "staff" && <SummaryStrip label="Total Money Taken" total={staffTotal} count={staffTx.length} formatINR={formatINR} />}
              {category === "vehicle" && <SummaryStrip label="Total Vehicle Expense" total={vehicleTotal} count={vehicleTx.length} formatINR={formatINR} />}
              {category === "other" && <SummaryStrip label="Total Misc Amount" total={otherTotal} count={otherEntries.length} formatINR={formatINR} />}
            </div>
            <div className="flex gap-2 ml-3">
              <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
              <Button size="sm" onClick={() => {
                if (category === "staff") openAddStaffTx();
                else if (category === "vehicle") openAddVehTx();
                else openAddOther();
              }}><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
          </div>

          {/* Results Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
              ) : (
                <>
                  {/* Staff Transactions Table */}
                  {category === "staff" && (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead>
                        {!entityId && <TableHead>Staff</TableHead>}
                        <TableHead>Money Taken</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {staffTx.length === 0 ? (
                          <TableRow><TableCell colSpan={entityId ? 4 : 5} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                        ) : staffTx.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>{t.entry_date}</TableCell>
                            {!entityId && <TableCell className="font-medium">{staffNameMap[t.staff_id] ?? "—"}</TableCell>}
                            <TableCell>{formatINR(Number(t.money_taken))}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{t.notes ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditStaffTx(t)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteStaffTxId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Vehicle Transactions Table */}
                  {category === "vehicle" && (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead>
                        {!entityId && <TableHead>Vehicle</TableHead>}
                        <TableHead>Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {vehicleTx.length === 0 ? (
                          <TableRow><TableCell colSpan={entityId ? 5 : 6} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                        ) : vehicleTx.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>{t.entry_date}</TableCell>
                            {!entityId && <TableCell className="font-medium font-mono">{vehicleNameMap[t.vehicle_id] ?? "—"}</TableCell>}
                            <TableCell>{formatINR(Number(t.amount))}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{t.reason}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{t.notes ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditVehTx(t)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteVehTxId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Other Entries Table */}
                  {category === "other" && (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {otherEntries.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries</TableCell></TableRow>
                        ) : otherEntries.map(e => (
                          <TableRow key={e.id}>
                            <TableCell>{e.entry_date}</TableCell>
                            <TableCell className="font-medium">{e.service}</TableCell>
                            <TableCell>{formatINR(Number(e.amount))}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{e.notes ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditOther(e)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteOtherId(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
        </div>
      </main>

      {/* ========== DIALOGS ========== */}

      {/* Staff Transaction Dialog */}
      <Dialog open={staffTxDialog} onOpenChange={setStaffTxDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editStaffTx ? "Edit Transaction" : "Add Staff Transaction"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editStaffTx && (
              <div>
                <Label>Staff Member *</Label>
                <SearchableSelect
                  value={stfStaffId}
                  onValueChange={setStfStaffId}
                  options={members.map(m => ({ value: m.id, label: m.staff_name }))}
                  placeholder="Select staff..."
                  searchPlaceholder="Search..."
                />
              </div>
            )}
            <div><Label>Date *</Label><Input type="date" value={stfDate} onChange={e => setStfDate(e.target.value)} /></div>
            <div><Label>Money Taken *</Label><CurrencyInput value={stfAmount} onChange={setStfAmount} /></div>
            <div><Label>Notes</Label><Textarea value={stfNotes} onChange={e => setStfNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffTxDialog(false)}>Cancel</Button>
            <Button onClick={saveStaffTx} disabled={!stfDate || stfAmount <= 0 || (!editStaffTx && !stfStaffId)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Transaction Dialog */}
      <Dialog open={vehTxDialog} onOpenChange={setVehTxDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editVehTx ? "Edit Transaction" : "Add Vehicle Transaction"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editVehTx && (
              <div>
                <Label>Vehicle *</Label>
                <SearchableSelect
                  value={vehVehicleId}
                  onValueChange={setVehVehicleId}
                  options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_number} (${v.vehicle_type})` }))}
                  placeholder="Select vehicle..."
                  searchPlaceholder="Search..."
                />
              </div>
            )}
            <div><Label>Date *</Label><Input type="date" value={vehDate} onChange={e => setVehDate(e.target.value)} /></div>
            <div><Label>Amount *</Label><CurrencyInput value={vehAmount} onChange={setVehAmount} /></div>
            <div><Label>Reason *</Label><Input value={vehReason} onChange={e => setVehReason(e.target.value)} /></div>
            <div><Label>Notes</Label><Textarea value={vehNotes} onChange={e => setVehNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehTxDialog(false)}>Cancel</Button>
            <Button onClick={saveVehTx} disabled={!vehDate || vehAmount <= 0 || !vehReason || (!editVehTx && !vehVehicleId)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Other Entry Dialog */}
      <Dialog open={otherDialog} onOpenChange={setOtherDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editOther ? "Edit Entry" : "Add Other Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date *</Label><Input type="date" value={othDate} onChange={e => setOthDate(e.target.value)} /></div>
            <div><Label>Service *</Label><Input value={othService} onChange={e => setOthService(e.target.value)} /></div>
            <div><Label>Amount *</Label><CurrencyInput value={othAmount} onChange={setOthAmount} /></div>
            <div><Label>Notes</Label><Textarea value={othNotes} onChange={e => setOthNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtherDialog(false)}>Cancel</Button>
            <Button onClick={saveOther} disabled={!othDate || !othService || othAmount <= 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!deleteStaffTxId} onOpenChange={() => setDeleteStaffTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteStaffTxId) { await removeStaffTx(deleteStaffTxId); setDeleteStaffTxId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVehTxId} onOpenChange={() => setDeleteVehTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteVehTxId) { await removeVehicleTx(deleteVehTxId); setDeleteVehTxId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOtherId} onOpenChange={() => setDeleteOtherId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteOtherId) { await removeOther(deleteOtherId); setDeleteOtherId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== ENTITY MANAGEMENT DIALOG ========== */}
      <Dialog open={manageDialog} onOpenChange={setManageDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage {category === "staff" ? "Staff Members" : "Vehicles"}</DialogTitle>
          </DialogHeader>

          {category === "staff" && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{members.length} members</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportStaffMembers(members)}><FileDown className="w-3.5 h-3.5 mr-1" />CSV</Button>
                  <Button size="sm" onClick={openAddMember}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
                </div>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Salary</TableHead><TableHead>Active</TableHead><TableHead className="w-20"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.staff_name}</TableCell>
                      <TableCell>{formatINR(m.monthly_salary)}</TableCell>
                      <TableCell>{m.active ? "✅" : "❌"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditMember(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteMemberId(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {category === "vehicle" && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{vehicles.length} vehicles</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportVehicles(vehicles)}><FileDown className="w-3.5 h-3.5 mr-1" />CSV</Button>
                  <Button size="sm" onClick={openAddVehicle}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
                </div>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Number</TableHead><TableHead>Type</TableHead><TableHead>Active</TableHead><TableHead className="w-20"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vehicles.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium font-mono">{v.vehicle_number}</TableCell>
                      <TableCell>{v.vehicle_type}</TableCell>
                      <TableCell>{v.active ? "✅" : "❌"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditVehicle(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteVehicleId(v.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Staff Member CRUD Dialog */}
      <Dialog open={staffMemberDialog} onOpenChange={setStaffMemberDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMember ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={mName} onChange={e => setMName(e.target.value)} /></div>
            <div><Label>Monthly Salary *</Label><CurrencyInput value={mSalary} onChange={setMSalary} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={mActive} onChange={e => setMActive(e.target.checked)} id="sm-active" />
              <Label htmlFor="sm-active">Active</Label>
            </div>
            <div><Label>Notes</Label><Textarea value={mNotes} onChange={e => setMNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffMemberDialog(false)}>Cancel</Button>
            <Button onClick={saveMember} disabled={!mName || mSalary <= 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle CRUD Dialog */}
      <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Vehicle Number *</Label><Input value={vNum} onChange={e => setVNum(e.target.value)} /></div>
            <div><Label>Vehicle Type *</Label><Input value={vType} onChange={e => setVType(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={vActive} onChange={e => setVActive(e.target.checked)} id="veh-active" />
              <Label htmlFor="veh-active">Active</Label>
            </div>
            <div><Label>Notes</Label><Textarea value={vNotes} onChange={e => setVNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleDialog(false)}>Cancel</Button>
            <Button onClick={saveVehicle} disabled={!vNum || !vType}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete member/vehicle confirms */}
      <AlertDialog open={!!deleteMemberId} onOpenChange={() => setDeleteMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all their transactions.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteMemberId) { await removeMember(deleteMemberId); setDeleteMemberId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVehicleId} onOpenChange={() => setDeleteVehicleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all transactions for this vehicle.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteVehicleId) { await removeVehicle(deleteVehicleId); setDeleteVehicleId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomNav />
    </div>
  );
};

export default StaffManagement;
