import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Check, X, Eye, Loader2 } from "lucide-react";
import type { InventoryChangeRequest, useInventoryRequests } from "@/hooks/useInventoryRequests";

export const REQUEST_ACTION_LABELS: Record<string, string> = {
  add_stock: "Add Stock", sale_stock: "Sale Stock", transfer_stock: "Transfer Stock",
  edit_stand_quantity: "Change Stand-wise Quantity", add_glass_type: "Add Glass Type", edit_glass_type: "Edit Glass Type",
  add_glass_variant: "Add Glass Variant", edit_glass_variant: "Edit Glass Variant", add_stock_item: "Add Size / Sheets",
  edit_stock_item: "Edit Size / Sheets", add_stand: "Add Stand", edit_stand: "Edit Stand", import_inventory: "Inventory Import",
};

const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

function StatusBadge({ s }: { s: string }) {
  if (s === "approved") return <Badge className="bg-accent text-accent-foreground border-transparent">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge className="bg-amber-500 text-white border-transparent">Pending</Badge>;
}

export function InventoryApprovalsDialog({ open, onOpenChange, reqs, onApplied }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  reqs: ReturnType<typeof useInventoryRequests>; onApplied: () => void;
}) {
  const { isAdmin, user } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<InventoryChangeRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("user_id, display_name, email").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p.display_name || p.email; });
      setNames(m);
    });
  }, [open]);

  const pending = useMemo(() => reqs.requests.filter(r => r.status === "pending"), [reqs.requests]);
  const mine = useMemo(() => reqs.requests.filter(r => r.requested_by === user?.id), [reqs.requests, user]);

  const openDetail = (r: InventoryChangeRequest) => { setDetail(r); setRejecting(false); setReason(""); setConflict(null); };

  const decide = async (decision: "approve" | "reject") => {
    if (!detail) return;
    setBusy(true); setConflict(null);
    const err = await reqs.review(detail.id, decision, decision === "reject" ? reason : undefined);
    setBusy(false);
    if (err) {
      setConflict(err);
      toast({ title: decision === "approve" ? "Cannot approve" : "Cannot reject", description: err, variant: "destructive" });
      return;
    }
    if (decision === "approve") { toast({ title: "Inventory change approved and applied successfully." }); onApplied(); }
    else toast({ title: "Inventory change request rejected." });
    setDetail(null);
  };

  const table = (rows: InventoryChangeRequest[], adminView: boolean) => (
    rows.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No requests.</p> :
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>#</TableHead><TableHead>Date &amp; Time</TableHead>
          {adminView && <TableHead>Requested By</TableHead>}
          <TableHead>Action</TableHead><TableHead>Change</TableHead><TableHead>Status</TableHead>
          {!adminView && <TableHead>Reviewed</TableHead>}
          <TableHead className="text-right">{adminView ? "Review" : "Details"}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
            <TableCell className="text-xs whitespace-nowrap">{when(r.created_at)}</TableCell>
            {adminView && <TableCell className="text-xs">{names[r.requested_by] ?? "—"}<div className="text-muted-foreground capitalize">{r.requester_role}</div></TableCell>}
            <TableCell className="text-xs">{REQUEST_ACTION_LABELS[r.action_type] ?? r.action_type}</TableCell>
            <TableCell className="text-xs max-w-[280px]">{r.summary}</TableCell>
            <TableCell><StatusBadge s={r.status} /></TableCell>
            {!adminView && <TableCell className="text-xs">{r.reviewed_by ? `${names[r.reviewed_by] ?? "Admin"} · ${when(r.reviewed_at)}` : "—"}
              {r.rejection_reason && <div className="text-destructive">{r.rejection_reason}</div>}</TableCell>}
            <TableCell className="text-right">
              <Button size="sm" variant={adminView && r.status === "pending" ? "default" : "outline"} onClick={() => openDetail(r)}>
                <Eye className="w-3.5 h-3.5 mr-1" />{adminView && r.status === "pending" ? "Review" : "View"}
              </Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inventory Approvals{isAdmin ? ` (${pending.length} Pending)` : ""}</DialogTitle>
            <DialogDescription>
              {isAdmin ? "Review each Manager/Staff change one by one. Live stock changes only after approval." : "Your inventory change requests and their approval status."}
            </DialogDescription>
          </DialogHeader>
          {isAdmin ? (
            <Tabs defaultValue="pending">
              <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="all">All Requests</TabsTrigger></TabsList>
              <TabsContent value="pending">{table(pending, true)}</TabsContent>
              <TabsContent value="all">{table(reqs.requests, true)}</TabsContent>
            </Tabs>
          ) : table(mine, false)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && <>
            <DialogHeader>
              <DialogTitle>Request #{detail.request_number} — {REQUEST_ACTION_LABELS[detail.action_type] ?? detail.action_type}</DialogTitle>
              <DialogDescription>{detail.summary}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Requested by:</span> {names[detail.requested_by] ?? "—"} <span className="capitalize text-muted-foreground">({detail.requester_role})</span></div>
              <div><span className="text-muted-foreground">Submitted:</span> {when(detail.created_at)}</div>
              <div><span className="text-muted-foreground">Status:</span> <StatusBadge s={detail.status} /></div>
              {detail.reviewed_by && <div><span className="text-muted-foreground">Reviewed:</span> {names[detail.reviewed_by] ?? "Admin"} · {when(detail.reviewed_at)}</div>}
            </div>
            {detail.rejection_reason && <p className="text-sm text-destructive">Reason: {detail.rejection_reason}</p>}
            <Table>
              <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Current Value</TableHead><TableHead>Proposed Value</TableHead></TableRow></TableHeader>
              <TableBody>{(detail.changes ?? []).map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.field}</TableCell>
                  <TableCell>{fmt(c.current)}</TableCell>
                  <TableCell className="font-semibold text-primary">{fmt(c.proposed)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Current values are as of submission; approval rechecks the latest stock and blocks the change if it no longer fits.</p>
            {conflict && <p className="text-sm text-destructive rounded-md border border-destructive/40 p-2">{conflict}</p>}
            {isAdmin && detail.status === "pending" && rejecting && (
              <div><Label>Rejection reason (optional)</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} /></div>
            )}
            {isAdmin && detail.status === "pending" && (
              <DialogFooter className="gap-2">
                {!rejecting ? <>
                  <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}><X className="w-4 h-4 mr-1" />Reject</Button>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => decide("approve")} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Approve
                  </Button>
                </> : <>
                  <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
                  <Button variant="destructive" onClick={() => decide("reject")} disabled={busy}>Confirm Reject</Button>
                </>}
              </DialogFooter>
            )}
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
