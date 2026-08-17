import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, FileDown, Upload, Loader2 } from "lucide-react";
import {
  parseImportFile, buildImportPlan, downloadImportTemplate,
  groupByStand, groupByCategory, itemLabel, sizeLabel,
  type ImportPlan,
} from "@/utils/inventoryImport";
import type { useInventory } from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inv: ReturnType<typeof useInventory>;
}

export function ImportInventoryDialog({ open, onOpenChange, inv }: Props) {
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [createStands, setCreateStands] = useState(true);

  const reset = () => { setFileName(""); setPlan(null); setImporting(false); setParsing(false); };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) throw new Error("No data rows found in the file.");
      const built = buildImportPlan(rows, {
        glassTypes: inv.glassTypes, variants: inv.variants,
        stockItems: inv.stockItems, stands: inv.stands,
      });
      setPlan(built);
    } catch (err: any) {
      console.error("Inventory import parse error:", err);
      setPlan(null);
      toast({ title: "Inventory import failed. Please check file format.", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const unassigned = plan?.items.filter(i => !i.hasStands || i.unassignedSheets > 0) ?? [];
  const itemWarnings = plan?.items.flatMap(i => i.warnings.map(w => `${itemLabel(i)} — ${w}`)) ?? [];
  const allWarnings = [...(plan?.warnings ?? []), ...itemWarnings];

  const commit = async () => {
    if (!plan) return;
    setImporting(true);
    const res = await inv.importInventory(
      plan.items.map(i => ({
        glassType: i.glassType, thickness: i.thickness, company: i.company, color: i.color,
        size: { length: i.size.length, breadth: i.size.breadth, unit: i.size.unit },
        totalSheets: i.totalSheets, notes: i.notes,
        stands: i.stands.map(s => ({ standNumber: s.standNumber, standId: s.standId, sheets: s.sheets })),
      })),
      { createMissingStands: createStands },
    );
    setImporting(false);
    if (!res.ok) {
      toast({ title: "Inventory import failed. Please check file format.", description: res.error, variant: "destructive" });
      return;
    }
    const summary = `${res.created} new, ${res.updated} updated, ${res.standsCreated} stands created`;
    if (allWarnings.length > 0) {
      toast({ title: "Inventory imported with warnings. Please review highlighted items.", description: summary });
    } else {
      toast({ title: "Inventory imported successfully.", description: summary });
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Inventory (with stand-wise stock)</DialogTitle>
          <DialogDescription>
            Upload an Excel/CSV file. Multiple rows of the same item are combined and split across stands.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={downloadImportTemplate}>
            <FileDown className="w-4 h-4 mr-1" />Download Import Template
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
            <span className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="w-4 h-4 mr-1" />{plan ? "Choose another file" : "Upload Excel / CSV"}
            </span>
          </label>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          {parsing && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>

        {plan && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{plan.rowCount} rows</Badge>
              <Badge variant="secondary">{plan.items.length} inventory items</Badge>
              <Badge variant="secondary">{groupByStand(plan).length} stands</Badge>
              {plan.newStandNumbers.length > 0 && <Badge>{plan.newStandNumbers.length} new stands</Badge>}
              {allWarnings.length > 0 && (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{allWarnings.length} warnings</Badge>
              )}
              {plan.errors.length > 0 && <Badge variant="destructive">{plan.errors.length} errors</Badge>}
            </div>

            <Tabs defaultValue="stand">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="stand">Stand-wise</TabsTrigger>
                <TabsTrigger value="category">Category-wise</TabsTrigger>
                <TabsTrigger value="none">No Stand Assigned ({unassigned.length})</TabsTrigger>
                <TabsTrigger value="warn">Warnings / Errors ({allWarnings.length + plan.errors.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="stand" className="space-y-3">
                {groupByStand(plan).length === 0 && <p className="text-sm text-muted-foreground py-4">No stand-wise rows in this file.</p>}
                {groupByStand(plan).map(g => (
                  <Card key={g.standNumber}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {g.standNumber} {g.isNew && <Badge variant="outline" className="ml-2">new stand</Badge>}
                        </span>
                        <Badge variant="secondary">{g.total} sheets</Badge>
                      </div>
                      {g.lines.map((l, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                          <span>{l.label}</span><span>{l.sheets} sheets</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="category" className="space-y-3">
                {groupByCategory(plan).map(g => (
                  <Card key={g.glassType}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{g.glassType}</span>
                        <Badge variant="secondary">{g.total} sheets</Badge>
                      </div>
                      {g.items.map(it => {
                        const mismatch = it.hasStands && it.standTotal !== it.totalSheets;
                        return (
                          <div key={it.key} className={`flex flex-wrap justify-between gap-2 text-sm rounded px-2 py-1 ${mismatch ? "bg-amber-50 text-amber-900" : "text-muted-foreground"}`}>
                            <span>{[it.thickness, it.company, it.color, it.size.raw || sizeLabel(it.size)].filter(Boolean).join(" | ")}</span>
                            <span className="flex items-center gap-2">
                              Total: {it.totalSheets} · Stand Total: {it.standTotal}
                              {mismatch && <AlertTriangle className="w-3.5 h-3.5" />}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="none" className="space-y-2">
                {unassigned.length === 0 && <p className="text-sm text-muted-foreground py-4">Every row has a stand number.</p>}
                {unassigned.map(it => (
                  <div key={it.key} className="flex flex-wrap justify-between gap-2 rounded border p-3 text-sm">
                    <span>{itemLabel(it)}</span>
                    <Badge variant="outline">
                      {it.hasStands ? `${it.unassignedSheets} unassigned` : `Total Sheets: ${it.totalSheets}`}
                    </Badge>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="warn" className="space-y-2">
                {plan.errors.map((e, i) => (
                  <div key={`e${i}`} className="rounded border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{e}</div>
                ))}
                {allWarnings.map((w, i) => (
                  <div key={`w${i}`} className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{w}</div>
                ))}
                {plan.errors.length === 0 && allWarnings.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No issues found.</p>
                )}
              </TabsContent>
            </Tabs>

            {plan.newStandNumbers.length > 0 && (
              <div className="flex items-start gap-2 rounded border p-3">
                <Checkbox id="create-stands" checked={createStands} onCheckedChange={v => setCreateStands(!!v)} />
                <Label htmlFor="create-stands" className="text-sm font-normal">
                  Create missing stand numbers automatically: {plan.newStandNumbers.join(", ")}
                  <span className="block text-xs text-muted-foreground">
                    If unchecked, rows with these stand numbers are imported as totals only (no stand mapping).
                  </span>
                </Label>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={commit} disabled={!plan || importing || plan.items.length === 0}>
            {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Confirm Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
