import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { LoadingSpinner } from "@/components/LoadingStates";
import {
  useInventory, useInventoryActivityLog,
  GlassType, GlassVariant, GlassStockItem, Unit,
} from "@/hooks/useInventory";
import { exportAllInventory, exportGlassTypeInventory, exportActivityLog } from "@/utils/exportInventoryCSV";
import { ArrowLeft, Plus, Pencil, Trash2, FileDown, Search, History, ChevronRight, Layers, Boxes } from "lucide-react";

const UNITS: Unit[] = ["ft", "inch", "mm"];

type View = "types" | "type" | "variant";

const InventoryManagement = () => {
  const { isAdmin } = useAuth();
  const inv = useInventory();
  const { glassTypes, variants, stockItems, sheetsByVariant, variantsByType, sheetsByType } = inv;

  const [view, setView] = useState<View>("types");
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const [unitFilter, setUnitFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [thicknessFilter, setThicknessFilter] = useState("");

  // ---- Activity log ----
  const [showActivity, setShowActivity] = useState(false);

  // ---- Glass type dialog ----
  const [typeDialog, setTypeDialog] = useState(false);
  const [editType, setEditType] = useState<GlassType | null>(null);
  const [deleteTypeId, setDeleteTypeId] = useState<string | null>(null);
  const [tName, setTName] = useState("");
  const [tNotes, setTNotes] = useState("");

  // ---- Variant dialog ----
  const [variantDialog, setVariantDialog] = useState(false);
  const [editVariant, setEditVariant] = useState<GlassVariant | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [vThickness, setVThickness] = useState("");
  const [vCompany, setVCompany] = useState("");
  const [vColor, setVColor] = useState("");
  const [vNotes, setVNotes] = useState("");

  // ---- Stock item dialog ----
  const [itemDialog, setItemDialog] = useState(false);
  const [editItem, setEditItem] = useState<GlassStockItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [iLength, setILength] = useState("");
  const [iBreadth, setIBreadth] = useState("");
  const [iUnit, setIUnit] = useState<Unit>("ft");
  const [iSheets, setISheets] = useState("");
  const [iComment, setIComment] = useState("");

  const activeType = useMemo(() => glassTypes.find(t => t.id === activeTypeId) ?? null, [glassTypes, activeTypeId]);
  const activeVariant = useMemo(() => variants.find(v => v.id === activeVariantId) ?? null, [variants, activeVariantId]);

  // ---- Distinct filter options ----
  const companies = useMemo(() => [...new Set(variants.map(v => v.company_purchased))].sort(), [variants]);
  const thicknesses = useMemo(() => [...new Set(variants.map(v => v.thickness))].sort(), [variants]);

  const q = search.trim().toLowerCase();

  // ---- Filtered glass types (search across everything) ----
  const filteredTypes = useMemo(() => {
    if (!q && !unitFilter && !companyFilter && !thicknessFilter) return glassTypes;
    const variantMap = new Map(variants.map(v => [v.id, v]));
    return glassTypes.filter(t => {
      const typeVariants = variantsByType[t.id] ?? [];
      if (q && t.glass_type_name.toLowerCase().includes(q)) return true;
      // match within variants / items
      const matched = typeVariants.some(v => {
        if (companyFilter && v.company_purchased !== companyFilter) return false;
        if (thicknessFilter && v.thickness !== thicknessFilter) return false;
        const items = stockItems.filter(i => i.glass_variant_id === v.id);
        const itemMatch = items.some(i => {
          if (unitFilter && i.unit !== unitFilter) return false;
          if (!q) return true;
          return (
            String(i.length).includes(q) || String(i.breadth).includes(q) ||
            (i.comment ?? "").toLowerCase().includes(q)
          );
        });
        const variantTextMatch = !q || v.thickness.toLowerCase().includes(q) || v.company_purchased.toLowerCase().includes(q) || (v.color ?? "").toLowerCase().includes(q) || (v.notes ?? "").toLowerCase().includes(q);
        const filtersActive = unitFilter || companyFilter || thicknessFilter;
        if (filtersActive) return unitFilter ? itemMatch : (variantTextMatch || itemMatch);
        return variantTextMatch || itemMatch;
      });
      return matched;
    });
  }, [glassTypes, variants, variantsByType, stockItems, q, unitFilter, companyFilter, thicknessFilter]);

  // ---- Variants of active type ----
  const typeVariants = useMemo(() => {
    const list = (activeTypeId ? variantsByType[activeTypeId] : []) ?? [];
    return list.filter(v => {
      if (companyFilter && v.company_purchased !== companyFilter) return false;
      if (thicknessFilter && v.thickness !== thicknessFilter) return false;
      if (!q) return true;
      return v.thickness.toLowerCase().includes(q) || v.company_purchased.toLowerCase().includes(q) || (v.notes ?? "").toLowerCase().includes(q);
    });
  }, [activeTypeId, variantsByType, companyFilter, thicknessFilter, q]);

  // ---- Stock items of active variant ----
  const variantItems = useMemo(() => {
    return stockItems.filter(i => i.glass_variant_id === activeVariantId).filter(i => {
      if (unitFilter && i.unit !== unitFilter) return false;
      if (!q) return true;
      return String(i.length).includes(q) || String(i.breadth).includes(q) || (i.comment ?? "").toLowerCase().includes(q);
    });
  }, [stockItems, activeVariantId, unitFilter, q]);

  // ---- Navigation ----
  const openType = (id: string) => { setActiveTypeId(id); setView("type"); setSearch(""); };
  const openVariant = (id: string) => { setActiveVariantId(id); setView("variant"); setSearch(""); };
  const backToTypes = () => { setView("types"); setActiveTypeId(null); setActiveVariantId(null); };
  const backToType = () => { setView("type"); setActiveVariantId(null); };

  // ---- Glass type handlers ----
  const openAddType = () => { setEditType(null); setTName(""); setTNotes(""); setTypeDialog(true); };
  const openEditType = (t: GlassType) => { setEditType(t); setTName(t.glass_type_name); setTNotes(t.notes ?? ""); setTypeDialog(true); };
  const saveType = async () => {
    if (!tName.trim()) return;
    const ok = editType
      ? await inv.updateGlassType(editType.id, { glass_type_name: tName.trim(), notes: tNotes.trim() || null })
      : await inv.createGlassType({ glass_type_name: tName.trim(), notes: tNotes.trim() || null });
    if (ok) setTypeDialog(false);
  };

  // ---- Variant handlers ----
  const openAddVariant = () => { setEditVariant(null); setVThickness(""); setVCompany("General"); setVColor(""); setVNotes(""); setVariantDialog(true); };
  const openEditVariant = (v: GlassVariant) => { setEditVariant(v); setVThickness(v.thickness); setVCompany(v.company_purchased); setVColor(v.color ?? ""); setVNotes(v.notes ?? ""); setVariantDialog(true); };
  const saveVariant = async () => {
    if (!vThickness.trim() || !vCompany.trim() || !activeTypeId) return;
    const ok = editVariant
      ? await inv.updateVariant(editVariant.id, { thickness: vThickness.trim(), company_purchased: vCompany.trim(), color: vColor.trim() || null, notes: vNotes.trim() || null })
      : await inv.createVariant({ glass_type_id: activeTypeId, thickness: vThickness.trim(), company_purchased: vCompany.trim(), color: vColor.trim() || null, notes: vNotes.trim() || null });
    if (ok) setVariantDialog(false);
  };

  // ---- Stock item handlers ----
  const openAddItem = () => { setEditItem(null); setILength(""); setIBreadth(""); setIUnit("ft"); setISheets(""); setIComment(""); setItemDialog(true); };
  const openEditItem = (i: GlassStockItem) => { setEditItem(i); setILength(String(i.length)); setIBreadth(String(i.breadth)); setIUnit(i.unit); setISheets(String(i.number_of_sheets)); setIComment(i.comment ?? ""); setItemDialog(true); };
  const saveItem = async () => {
    if (!iLength || !iBreadth || !activeVariantId) return;
    const payload = {
      length: Number(iLength), breadth: Number(iBreadth), unit: iUnit,
      number_of_sheets: Number(iSheets) || 0, comment: iComment.trim() || null,
    };
    const ok = editItem
      ? await inv.updateStockItem(editItem.id, payload)
      : await inv.createStockItem({ glass_variant_id: activeVariantId, ...payload });
    if (ok) setItemDialog(false);
  };

  if (!isAdmin) return null;
  if (inv.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><LoadingSpinner size="lg" /></div>;
  }

  const totalSheets = stockItems.reduce((s, i) => s + Number(i.number_of_sheets), 0);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-lg md:text-2xl font-bold text-primary">Inventory Management</h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowActivity(true)}>
            <History className="w-4 h-4 md:mr-1" />
            <span className="hidden md:inline">Activity Log</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-6 space-y-4">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={backToTypes}>Glass Types</button>
          {activeType && view !== "types" && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <button className="hover:text-foreground" onClick={backToType}>{activeType.glass_type_name}</button>
            </>
          )}
          {activeVariant && view === "variant" && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{activeVariant.thickness} {activeVariant.company_purchased}</span>
            </>
          )}
        </div>

        {/* Summary + Search row */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search type, thickness, company, dimension, comment..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={thicknessFilter} onChange={e => setThicknessFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All Thickness</option>
              {thicknesses.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All Company</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All Units</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* ====== VIEW: GLASS TYPES ====== */}
        {view === "types" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openAddType}><Plus className="w-4 h-4 mr-1" />Add Glass Type</Button>
              <Button variant="outline" onClick={() => exportAllInventory(glassTypes, variants, stockItems)}>
                <FileDown className="w-4 h-4 mr-1" />Export All
              </Button>
              <div className="ml-auto flex gap-2">
                <Badge variant="secondary" className="gap-1"><Layers className="w-3.5 h-3.5" />{glassTypes.length} Types</Badge>
                <Badge variant="secondary" className="gap-1"><Boxes className="w-3.5 h-3.5" />{totalSheets} Sheets</Badge>
              </div>
            </div>

            {/* Desktop table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Glass Type</TableHead>
                      <TableHead className="text-right">Variants</TableHead>
                      <TableHead className="text-right">Total Sheets</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTypes.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No glass types yet.</TableCell></TableRow>
                    )}
                    {filteredTypes.map(t => (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => openType(t.id)}>
                        <TableCell className="font-medium">{t.glass_type_name}</TableCell>
                        <TableCell className="text-right">{(variantsByType[t.id] ?? []).length}</TableCell>
                        <TableCell className="text-right font-semibold">{sheetsByType[t.id] ?? 0}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{t.notes}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openType(t.id)}><ChevronRight className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditType(t)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTypeId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredTypes.length === 0 && <p className="text-center text-muted-foreground py-8">No glass types yet.</p>}
              {filteredTypes.map(t => (
                <Card key={t.id} onClick={() => openType(t.id)} className="cursor-pointer">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold">{t.glass_type_name}</span>
                      <Badge variant="secondary">{sheetsByType[t.id] ?? 0} sheets</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{(variantsByType[t.id] ?? []).length} variants</p>
                    {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => openType(t.id)}>View</Button>
                      <Button variant="outline" size="sm" onClick={() => openEditType(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTypeId(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ====== VIEW: INSIDE GLASS TYPE (variants) ====== */}
        {view === "type" && activeType && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openAddVariant}><Plus className="w-4 h-4 mr-1" />Add Thickness + Company</Button>
              <Button variant="outline" onClick={() => exportGlassTypeInventory(activeType.glass_type_name, activeType.id, glassTypes, variants, stockItems)}>
                <FileDown className="w-4 h-4 mr-1" />Export This Type
              </Button>
            </div>

            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thickness</TableHead>
                      <TableHead>Company Purchased</TableHead>
                      <TableHead className="text-right">Total Sheets</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeVariants.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No variants yet.</TableCell></TableRow>
                    )}
                    {typeVariants.map(v => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => openVariant(v.id)}>
                        <TableCell className="font-medium">{v.thickness}</TableCell>
                        <TableCell>{v.company_purchased}</TableCell>
                        <TableCell className="text-right font-semibold">{sheetsByVariant[v.id] ?? 0}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{v.notes}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openVariant(v.id)}><ChevronRight className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditVariant(v)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteVariantId(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-3 md:hidden">
              {typeVariants.length === 0 && <p className="text-center text-muted-foreground py-8">No variants yet.</p>}
              {typeVariants.map(v => (
                <Card key={v.id} onClick={() => openVariant(v.id)} className="cursor-pointer">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold">{v.thickness} · {v.company_purchased}</span>
                      <Badge variant="secondary">{sheetsByVariant[v.id] ?? 0} sheets</Badge>
                    </div>
                    {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => openVariant(v.id)}>View Sizes</Button>
                      <Button variant="outline" size="sm" onClick={() => openEditVariant(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteVariantId(v.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ====== VIEW: INSIDE VARIANT (stock items) ====== */}
        {view === "variant" && activeVariant && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openAddItem}><Plus className="w-4 h-4 mr-1" />Add Size / Sheets</Button>
              <Badge variant="secondary" className="ml-auto">Total: {sheetsByVariant[activeVariant.id] ?? 0} sheets</Badge>
            </div>

            <Card className="hidden md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Length</TableHead>
                      <TableHead className="text-right">Breadth</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Number of Sheets</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantItems.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No sizes yet.</TableCell></TableRow>
                    )}
                    {variantItems.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="text-right">{i.length}</TableCell>
                        <TableCell className="text-right">{i.breadth}</TableCell>
                        <TableCell>{i.unit}</TableCell>
                        <TableCell className="text-right font-semibold">{i.number_of_sheets}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{i.comment}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(i)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteItemId(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-3 md:hidden">
              {variantItems.length === 0 && <p className="text-center text-muted-foreground py-8">No sizes yet.</p>}
              {variantItems.map(i => (
                <Card key={i.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold">{i.length} × {i.breadth} {i.unit}</span>
                      <Badge variant="secondary">{i.number_of_sheets} sheets</Badge>
                    </div>
                    {i.comment && <p className="text-xs text-muted-foreground">{i.comment}</p>}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteItemId(i.id)}><Trash2 className="w-3.5 h-3.5 mr-1 text-destructive" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      <MobileBottomNav />

      {/* ====== Glass Type Dialog ====== */}
      <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editType ? "Edit Glass Type" : "Add Glass Type"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Glass Type Name *</Label><Input value={tName} onChange={e => setTName(e.target.value)} placeholder="e.g. Clear Glass" /></div>
            <div><Label>Notes</Label><Textarea value={tNotes} onChange={e => setTNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialog(false)}>Cancel</Button>
            <Button onClick={saveType} disabled={!tName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Variant Dialog ====== */}
      <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editVariant ? "Edit Variant" : "Add Thickness + Company"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Thickness *</Label><Input value={vThickness} onChange={e => setVThickness(e.target.value)} placeholder="e.g. 5mm" /></div>
            <div><Label>Company Purchased *</Label><Input value={vCompany} onChange={e => setVCompany(e.target.value)} placeholder="e.g. Saint Gobain" /></div>
            <div><Label>Notes</Label><Textarea value={vNotes} onChange={e => setVNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialog(false)}>Cancel</Button>
            <Button onClick={saveVariant} disabled={!vThickness.trim() || !vCompany.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Stock Item Dialog ====== */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Edit Size / Sheets" : "Add Size / Sheets"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Length *</Label><Input type="number" inputMode="decimal" value={iLength} onChange={e => setILength(e.target.value)} /></div>
              <div><Label>Breadth *</Label><Input type="number" inputMode="decimal" value={iBreadth} onChange={e => setIBreadth(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <select value={iUnit} onChange={e => setIUnit(e.target.value as Unit)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><Label>Number of Sheets</Label><Input type="number" inputMode="numeric" value={iSheets} onChange={e => setISheets(e.target.value)} /></div>
            </div>
            <div><Label>Comment</Label><Textarea value={iComment} onChange={e => setIComment(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button onClick={saveItem} disabled={!iLength || !iBreadth}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Activity Log ====== */}
      <ActivityLogDialog open={showActivity} onOpenChange={setShowActivity} glassTypes={glassTypes} variants={variants} />

      {/* ====== Delete confirmations ====== */}
      <AlertDialog open={!!deleteTypeId} onOpenChange={() => setDeleteTypeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete glass type?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the glass type and all its variants and sizes. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteTypeId) { await inv.deleteGlassType(deleteTypeId); setDeleteTypeId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVariantId} onOpenChange={() => setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the thickness + company and all its sizes. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteVariantId) { await inv.deleteVariant(deleteVariantId); setDeleteVariantId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete size entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteItemId) { await inv.deleteStockItem(deleteItemId); setDeleteItemId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ====== Activity Log Dialog component ======
const ACTION_LABELS: Record<string, string> = {
  created_glass_type: "Created glass type",
  updated_glass_type: "Updated glass type",
  deleted_glass_type: "Deleted glass type",
  created_variant: "Created variant",
  updated_variant: "Updated variant",
  deleted_variant: "Deleted variant",
  created_stock_item: "Added stock item",
  updated_stock_item: "Updated stock item",
  deleted_stock_item: "Deleted stock item",
};

function ActivityLogDialog({ open, onOpenChange, glassTypes, variants }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  glassTypes: GlassType[]; variants: GlassVariant[];
}) {
  const { entries } = useInventoryActivityLog();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const typeNameById = useMemo(() => Object.fromEntries(glassTypes.map(t => [t.id, t.glass_type_name])), [glassTypes]);
  const variantById = useMemo(() => Object.fromEntries(variants.map(v => [v.id, v])), [variants]);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, display_name, email").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p.display_name || p.email || p.user_id; });
      setUserNames(m);
    });
  }, [open]);

  const describe = (e: typeof entries[number]) => {
    const typeName = e.glass_type_id ? typeNameById[e.glass_type_id] : "";
    const v = e.glass_variant_id ? variantById[e.glass_variant_id] : undefined;
    const parts = [typeName, v ? `${v.thickness} ${v.company_purchased}` : ""].filter(Boolean);
    let detail = parts.join(" → ");
    if (e.action_type === "updated_stock_item" && e.old_value && e.new_value) {
      detail += ` — ${e.new_value.length}×${e.new_value.breadth} ${e.new_value.unit}, sheets ${e.old_value.number_of_sheets} → ${e.new_value.number_of_sheets}`;
    } else if (e.action_type === "created_stock_item" && e.new_value) {
      detail += ` — ${e.new_value.length}×${e.new_value.breadth} ${e.new_value.unit}, ${e.new_value.number_of_sheets} sheets`;
    } else if (e.action_type === "deleted_stock_item" && e.old_value) {
      detail += ` — ${e.old_value.length}×${e.old_value.breadth} ${e.old_value.unit}`;
    }
    return detail;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Inventory Activity Log</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => exportActivityLog(entries, typeNameById, variantById, userNames)}>
              <FileDown className="w-4 h-4 mr-1" />Export
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          {entries.length === 0 && <p className="text-center text-muted-foreground py-8">No activity yet.</p>}
          {entries.map(e => (
            <div key={e.id} className="border rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{ACTION_LABELS[e.action_type] ?? e.action_type}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(e.changed_at).toLocaleString()}</span>
              </div>
              <p className="font-medium">{describe(e)}</p>
              {e.comment && <p className="text-muted-foreground">{e.comment}</p>}
              <p className="text-xs text-muted-foreground">By {e.changed_by ? (userNames[e.changed_by] ?? "Unknown") : "Unknown"}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InventoryManagement;
