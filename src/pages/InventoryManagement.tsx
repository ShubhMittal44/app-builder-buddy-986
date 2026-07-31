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
import { ComboboxInput } from "@/components/ui/combobox-input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, FileDown, Search, History, ChevronRight, Layers, Boxes, PackagePlus, PackageMinus } from "lucide-react";

const UNITS: Unit[] = ["ft", "inch", "mm"];

// Default thickness options always offered in the typeahead.
const DEFAULT_THICKNESSES = ["3.5 mm", "4 mm", "5 mm", "6 mm", "8 mm", "10 mm", "12 mm", "15 mm", "19 mm"];

// Default length/breadth options always offered in the typeahead.
const DEFAULT_LENGTHS = ["8", "7", "6", "5", "4", "3"];
const DEFAULT_BREADTHS = ["4", "3", "2"];

// Normalize a value for case/spacing-insensitive comparison.
const normKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

// A bare number entered as thickness defaults to mm (e.g. "12" -> "12 mm").
const normalizeThickness = (s: string) => {
  const t = s.trim();
  if (!t) return t;
  return /^\d+(\.\d+)?$/.test(t) ? `${t} mm` : t;
};

// Build a variant label that includes color only when present.
const variantLabel = (v: { thickness: string; company_purchased: string; color: string | null }) =>
  [v.thickness, v.company_purchased, v.color?.trim()].filter(Boolean).join(" | ");

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

  // ---- Stock adjust (Add / Sale) ----
  const [stockDialog, setStockDialog] = useState(false);
  const [stockMode, setStockMode] = useState<"add_stock" | "sale_stock">("add_stock");
  const openStockDialog = (mode: "add_stock" | "sale_stock") => { setStockMode(mode); setStockDialog(true); };

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
  const [iUnit, setIUnit] = useState<Unit>("mm");
  const [iSheets, setISheets] = useState("");
  const [iComment, setIComment] = useState("");

  const activeType = useMemo(() => glassTypes.find(t => t.id === activeTypeId) ?? null, [glassTypes, activeTypeId]);
  const activeVariant = useMemo(() => variants.find(v => v.id === activeVariantId) ?? null, [variants, activeVariantId]);

  // ---- Distinct filter options ----
  const companies = useMemo(() => [...new Set(variants.map(v => v.company_purchased))].sort(), [variants]);
  const thicknesses = useMemo(() => [...new Set(variants.map(v => v.thickness))].sort(), [variants]);

  // ---- Reusable typeahead option lists (existing values + defaults) ----
  const thicknessOptions = useMemo(
    () => [...new Set([...DEFAULT_THICKNESSES, ...variants.map(v => v.thickness)])],
    [variants]
  );
  const companyOptions = useMemo(
    () => [...new Set(["General", ...variants.map(v => v.company_purchased)])],
    [variants]
  );
  const colorOptions = useMemo(
    () => [...new Set(variants.map(v => (v.color ?? "").trim()).filter(Boolean))],
    [variants]
  );
  const lengthOptions = useMemo(
    () => [...new Set([...DEFAULT_LENGTHS, ...stockItems.map(i => String(i.length))])],
    [stockItems]
  );
  const breadthOptions = useMemo(
    () => [...new Set([...DEFAULT_BREADTHS, ...stockItems.map(i => String(i.breadth))])],
    [stockItems]
  );

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

  // ---- Variants of active type (sorted by total sheets DESC) ----
  const typeVariants = useMemo(() => {
    const list = (activeTypeId ? variantsByType[activeTypeId] : []) ?? [];
    return list.filter(v => {
      if (companyFilter && v.company_purchased !== companyFilter) return false;
      if (thicknessFilter && v.thickness !== thicknessFilter) return false;
      if (!q) return true;
      return v.thickness.toLowerCase().includes(q) || v.company_purchased.toLowerCase().includes(q) || (v.color ?? "").toLowerCase().includes(q) || (v.notes ?? "").toLowerCase().includes(q);
    }).sort((a, b) => (sheetsByVariant[b.id] ?? 0) - (sheetsByVariant[a.id] ?? 0));
  }, [activeTypeId, variantsByType, companyFilter, thicknessFilter, q, sheetsByVariant]);

  // ---- Stock items of active variant (sorted by sheets DESC) ----
  const variantItems = useMemo(() => {
    return stockItems.filter(i => i.glass_variant_id === activeVariantId).filter(i => {
      if (unitFilter && i.unit !== unitFilter) return false;
      if (!q) return true;
      return String(i.length).includes(q) || String(i.breadth).includes(q) || (i.comment ?? "").toLowerCase().includes(q);
    }).sort((a, b) => Number(b.number_of_sheets) - Number(a.number_of_sheets));
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
    // Default a bare-number thickness to mm (e.g. "12" -> "12 mm").
    const thickness = normalizeThickness(vThickness);
    // Duplicate prevention: same glass type + normalized thickness/company/color.
    const dupKey = `${normKey(thickness)}|${normKey(vCompany)}|${normKey(vColor)}`;
    const duplicate = (variantsByType[activeTypeId] ?? []).some(v =>
      v.id !== editVariant?.id &&
      `${normKey(v.thickness)}|${normKey(v.company_purchased)}|${normKey(v.color ?? "")}` === dupKey
    );
    if (duplicate) {
      toast({ title: "Duplicate variant", description: "This thickness/company/color combination already exists for this glass type.", variant: "destructive" });
      return;
    }
    const ok = editVariant
      ? await inv.updateVariant(editVariant.id, { thickness, company_purchased: vCompany.trim(), color: vColor.trim() || null, notes: vNotes.trim() || null })
      : await inv.createVariant({ glass_type_id: activeTypeId, thickness, company_purchased: vCompany.trim(), color: vColor.trim() || null, notes: vNotes.trim() || null });
    if (ok) setVariantDialog(false);
  };

  // ---- Stock item handlers ----
  const openAddItem = () => { setEditItem(null); setILength(""); setIBreadth(""); setIUnit("mm"); setISheets(""); setIComment(""); setItemDialog(true); };
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
              <span className="text-foreground font-medium">{variantLabel(activeVariant)}</span>
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

        {/* Stock adjustment actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openStockDialog("add_stock")}>
            <PackagePlus className="w-4 h-4 mr-1" />Add Stock
          </Button>
          <Button variant="secondary" onClick={() => openStockDialog("sale_stock")}>
            <PackageMinus className="w-4 h-4 mr-1" />Sale Stock
          </Button>
        </div>

        {/* ====== VIEW: GLASS TYPES ====== */}
        {view === "types" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && <Button onClick={openAddType}><Plus className="w-4 h-4 mr-1" />Add Glass Type</Button>}
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
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditType(t)}><Pencil className="w-4 h-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteTypeId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
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
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => openEditType(t)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => setDeleteTypeId(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
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
              {isAdmin && <Button onClick={openAddVariant}><Plus className="w-4 h-4 mr-1" />Add Thickness + Company</Button>}
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
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Total Sheets</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeVariants.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No variants yet.</TableCell></TableRow>
                    )}
                    {typeVariants.map(v => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => openVariant(v.id)}>
                        <TableCell className="font-medium">{v.thickness}</TableCell>
                        <TableCell>{v.company_purchased}</TableCell>
                        <TableCell>{v.color?.trim() ? v.color : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{sheetsByVariant[v.id] ?? 0}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{v.notes}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openVariant(v.id)}><ChevronRight className="w-4 h-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditVariant(v)}><Pencil className="w-4 h-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteVariantId(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
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
                    <p className="text-xs text-muted-foreground">Color: {v.color?.trim() ? v.color : "—"}</p>
                    {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => openVariant(v.id)}>View Sizes</Button>
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => openEditVariant(v)}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => setDeleteVariantId(v.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
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
              {isAdmin && <Button onClick={openAddItem}><Plus className="w-4 h-4 mr-1" />Add Size / Sheets</Button>}

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
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditItem(i)}><Pencil className="w-4 h-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => setDeleteItemId(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
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
                    {isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteItemId(i.id)}><Trash2 className="w-3.5 h-3.5 mr-1 text-destructive" />Delete</Button>
                    </div>
                    )}

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
            <div><Label>Thickness *</Label><ComboboxInput value={vThickness} onChange={setVThickness} options={thicknessOptions} placeholder="e.g. 5 mm" /></div>
            <div><Label>Company Purchased *</Label><ComboboxInput value={vCompany} onChange={setVCompany} options={companyOptions} placeholder="e.g. Saint Gobain or General" /></div>
            <div><Label>Color</Label><ComboboxInput value={vColor} onChange={setVColor} options={colorOptions} placeholder="Optional — e.g. Clear, Brown, Grey" /></div>
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
              <div><Label>Length *</Label><ComboboxInput value={iLength} onChange={setILength} options={lengthOptions} placeholder="e.g. 8" /></div>
              <div><Label>Breadth *</Label><ComboboxInput value={iBreadth} onChange={setIBreadth} options={breadthOptions} placeholder="e.g. 4" /></div>
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

      {/* ====== Add / Sale Stock ====== */}
      <StockAdjustDialog open={stockDialog} onOpenChange={setStockDialog} mode={stockMode} inv={inv} />

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
  add_stock: "Add Stock",
  sale_stock: "Sale Stock",
};

// Badge styling per action type (positive vs warning for stock movements).
const ACTION_BADGE_CLASS: Record<string, string> = {
  add_stock: "bg-accent text-accent-foreground border-transparent",
  sale_stock: "bg-amber-500 text-white border-transparent",
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
    const variantLabel = v ? `${v.thickness} ${v.company_purchased}${v.color?.trim() ? ` · ${v.color}` : ""}` : "";
    const parts = [typeName, variantLabel].filter(Boolean);
    let detail = parts.join(" → ");
    if (e.action_type === "updated_stock_item" && e.old_value && e.new_value) {
      detail += ` — ${e.new_value.length}×${e.new_value.breadth} ${e.new_value.unit}, sheets ${e.old_value.number_of_sheets} → ${e.new_value.number_of_sheets}`;
    } else if (e.action_type === "created_stock_item" && e.new_value) {
      detail += ` — ${e.new_value.length}×${e.new_value.breadth} ${e.new_value.unit}, ${e.new_value.number_of_sheets} sheets`;
    } else if (e.action_type === "deleted_stock_item" && e.old_value) {
      detail += ` — ${e.old_value.length}×${e.old_value.breadth} ${e.old_value.unit}`;
    } else if (e.action_type === "updated_variant" && e.old_value && e.new_value) {
      const oldColor = (e.old_value.color ?? "").trim();
      const newColor = (e.new_value.color ?? "").trim();
      if (oldColor !== newColor) {
        detail += ` — color changed from ${oldColor || "blank"} to ${newColor || "blank"}`;
      }
    } else if (e.action_type === "created_variant" && e.new_value?.color?.trim()) {
      detail += ` — color ${e.new_value.color}`;
    } else if ((e.action_type === "add_stock" || e.action_type === "sale_stock") && e.new_value) {
      const size = e.new_value.length != null ? ` ${e.new_value.length}×${e.new_value.breadth} ${e.new_value.unit ?? ""}` : "";
      const prev = e.old_value?.number_of_sheets ?? 0;
      const next = e.new_value?.number_of_sheets ?? 0;
      const changed = e.new_value?.changed_quantity ?? (next - prev);
      const sign = changed > 0 ? `+${changed}` : `${changed}`;
      detail += ` —${size}, sheets ${prev} → ${next} (${sign})`;
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
                <Badge variant="outline" className={ACTION_BADGE_CLASS[e.action_type] ?? ""}>{ACTION_LABELS[e.action_type] ?? e.action_type}</Badge>
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

// ====== Add / Sale Stock dialog ======
function StockAdjustDialog({ open, onOpenChange, mode, inv }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  mode: "add_stock" | "sale_stock";
  inv: ReturnType<typeof useInventory>;
}) {
  const { glassTypes, variants, stockItems, adjustStock } = inv;
  const [typeId, setTypeId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (open) { setTypeId(""); setVariantId(""); setItemId(""); setQuantity(""); setRemarks(""); setSubmitting(false); }
  }, [open]);

  const typeVariants = useMemo(() => variants.filter(v => v.glass_type_id === typeId), [variants, typeId]);
  const variantItems = useMemo(() => stockItems.filter(i => i.glass_variant_id === variantId), [stockItems, variantId]);
  const selectedItem = useMemo(() => stockItems.find(i => i.id === itemId) ?? null, [stockItems, itemId]);
  const currentStock = selectedItem ? Number(selectedItem.number_of_sheets) : 0;

  const isAdd = mode === "add_stock";
  const qtyNum = Number(quantity);
  const insufficient = !isAdd && Number.isFinite(qtyNum) && qtyNum > currentStock;
  const canSubmit = !!itemId && Number.isFinite(qtyNum) && qtyNum > 0 && !insufficient && !submitting;

  const submit = async () => {
    if (!canSubmit || !selectedItem) return;
    setSubmitting(true);
    const ok = await adjustStock({ inventory_id: selectedItem.id, action_type: mode, quantity: Math.trunc(qtyNum), remarks: remarks.trim() || undefined });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAdd ? "Add Stock" : "Sale Stock"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Glass Type *</Label>
            <select value={typeId} onChange={e => { setTypeId(e.target.value); setVariantId(""); setItemId(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select glass type</option>
              {glassTypes.map(t => <option key={t.id} value={t.id}>{t.glass_type_name}</option>)}
            </select>
          </div>
          <div>
            <Label>Thickness / Company / Color *</Label>
            <select value={variantId} onChange={e => { setVariantId(e.target.value); setItemId(""); }} disabled={!typeId} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="">Select variant</option>
              {typeVariants.map(v => <option key={v.id} value={v.id}>{variantLabel(v)}</option>)}
            </select>
          </div>
          <div>
            <Label>Size / Dimension *</Label>
            <select value={itemId} onChange={e => setItemId(e.target.value)} disabled={!variantId} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="">Select size</option>
              {variantItems.map(i => <option key={i.id} value={i.id}>{i.length}×{i.breadth} {i.unit} — {i.number_of_sheets} sheets</option>)}
            </select>
          </div>

          {selectedItem && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Current Stock: <span className="font-semibold">{currentStock} sheets</span>
            </div>
          )}

          <div>
            <Label>{isAdd ? "Quantity to Add" : "Quantity to Sale"} *</Label>
            <Input type="number" inputMode="numeric" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 5" />
            {insufficient && <p className="text-destructive text-xs mt-1">Insufficient stock available.</p>}
            {selectedItem && Number.isFinite(qtyNum) && qtyNum > 0 && !insufficient && (
              <p className="text-muted-foreground text-xs mt-1">New stock will be {currentStock + (isAdd ? Math.trunc(qtyNum) : -Math.trunc(qtyNum))} sheets.</p>
            )}
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit} className={isAdd ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}>
            {submitting ? "Saving…" : (isAdd ? "Add Stock" : "Sale Stock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InventoryManagement;

