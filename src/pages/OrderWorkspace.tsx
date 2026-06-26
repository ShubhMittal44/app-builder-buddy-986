import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Save, ChevronRight, FileIcon, Download, X, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FileUpload } from "@/components/ui/file-upload";
import { OrderStepper } from "@/components/OrderStepper";
import { StageBadge } from "@/components/ui/stage-badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { LoadingSpinner } from "@/components/LoadingStates";
import { toast } from "@/hooks/use-toast";
import { useOrder, useOrderMutations, OrderStage, SiteEnum, TimelineEntry } from "@/hooks/useOrders";
import { useFileUpload, UploadedFile } from "@/hooks/useFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { OnlineUsers } from "@/components/OnlineUsers";
import { useNotifications } from "@/hooks/useNotifications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OrderWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { order, loading, error } = useOrder(id);
  const backTo = (location.state as { from?: string } | null)?.from || "/orders";
  const { updateOrder, updateStage, forceCloseOrder } = useOrderMutations();
  const { uploadFiles, deleteFile, downloadFile, uploading, progress } = useFileUpload();
  const { notifyOrderUpdate } = useNotifications();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [freightAmount, setFreightAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [assignSite, setAssignSite] = useState<SiteEnum | "">("");
  const [processingSite, setProcessingSite] = useState<SiteEnum | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showForceCloseDialog, setShowForceCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOnOrdersPage = location.pathname === '/orders' || 
                         location.pathname.startsWith('/orders/') || 
                         location.pathname === '/new';

  // Populate form fields when order loads
  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name);
      setPhone(order.phone || "");
      setAddress(order.address || "");
      setCity(order.city || "");
      setOrderDate(order.order_date ? new Date(order.order_date) : undefined);
      setEstimatedDuration(order.estimated_duration?.toString() || "");
      setTotalAmount(order.total_amount || 0);
      setAdvanceAmount(order.advance_amount || 0);
      setFreightAmount(order.freight_amount || 0);
      setNotes(order.notes || "");
      setAssignSite(order.assign_site || "");
      setProcessingSite(order.processing_site || "");
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {error || "Order Not Found"}
          </h2>
          <Button asChild>
            <Link to="/">Back to Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const balance = totalAmount - advanceAmount + freightAmount;
  const uploadedFiles = Array.isArray(order.files) 
    ? order.files as unknown as UploadedFile[]
    : [];

  const canMoveToNextStage = () => {
    switch (order.stage) {
      case "intake":
        return true;
      case "assign_site":
        return assignSite !== "";
      case "processing":
        return processingSite !== "";
      case "dispatch":
        return true; // Files are optional
      case "fitting":
        return true;
      default:
        return false;
    }
  };

  const getNextStage = (): OrderStage => {
    switch (order.stage) {
      case "intake":
        return "assign_site";
      case "assign_site":
        return "processing";
      case "processing":
        return "dispatch";
      case "dispatch":
        return "fitting";
      case "fitting":
        return "closed";
      default:
        return order.stage;
    }
  };

  const getNextStageLabel = () => {
    switch (order.stage) {
      case "intake":
        return "Move to Assign Site";
      case "assign_site":
        return "Confirm Assign Site";
      case "processing":
        return "Processing Done";
      case "dispatch":
        return "Mark Dispatched";
      case "fitting":
        return "Close Order";
      default:
        return "";
    }
  };

  const handleNextStage = async () => {
    if (order.stage === "fitting") {
      setShowCloseDialog(true);
      return;
    }

    try {
      // Save site selection if on assign_site or processing stage
      if (order.stage === "assign_site" && assignSite) {
        await updateOrder(order.id, { assign_site: assignSite });
      } else if (order.stage === "processing" && processingSite) {
        await updateOrder(order.id, { processing_site: processingSite });
      }

      const nextStage = getNextStage();
      await updateStage(order.id, order, nextStage);
      
      // Send notification
      notifyOrderUpdate(order.order_number, nextStage, order.customer_name);
    } catch (err) {
      console.error("Failed to update stage:", err);
    }
  };

  const handleCloseOrder = async () => {
    try {
      await updateStage(order.id, order, "closed");
      setShowCloseDialog(false);
      navigate("/");
    } catch (err) {
      console.error("Failed to close order:", err);
      setShowCloseDialog(false);
    }
  };

  const handleForceClose = async () => {
    try {
      await forceCloseOrder(order.id, order);
      setShowForceCloseDialog(false);
      toast({
        title: "Order closed",
        description: "The order has been force closed.",
      });
    } catch (err) {
      console.error("Failed to force close order:", err);
      setShowForceCloseDialog(false);
    }
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Upload new files if any
      let allFiles = [...uploadedFiles];
      if (files.length > 0) {
        const newUploadedFiles = await uploadFiles(files, order.id);
        allFiles = [...allFiles, ...newUploadedFiles];
        setFiles([]); // Clear local files after upload
      }

      // Update order with all data including files
      await updateOrder(order.id, {
        customer_name: customerName,
        phone: phone || null,
        address: address || null,
        city: city || null,
        order_date: orderDate ? format(orderDate, 'yyyy-MM-dd') : order.order_date,
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : null,
        total_amount: totalAmount || null,
        advance_amount: advanceAmount || null,
        freight_amount: freightAmount || null,
        notes: notes || null,
        assign_site: assignSite || null,
        processing_site: processingSite || null,
        files: allFiles as any,
      });
    } catch (err) {
      console.error("Failed to save order:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (file: UploadedFile, index: number) => {
    const confirmed = window.confirm(`Delete ${file.name}?`);
    if (!confirmed) return;

    const success = await deleteFile(file.path);
    if (success) {
      // Remove from order files
      const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
      await updateOrder(order.id, {
        files: updatedFiles as any,
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to delete orders",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-delete-order', {
        body: { order_id: order.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        throw error;
      }

      const result = data as any;
      
      toast({
        title: "Order deleted",
        description: result.message || `Order #${order.order_number} has been deleted`,
      });

      navigate('/');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeline = Array.isArray(order.timeline) 
    ? order.timeline as unknown as TimelineEntry[]
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <h1 className="text-2xl font-bold text-primary">
                RGH – Order Management
              </h1>
            </Link>
            <nav className="flex gap-3">
              {!isOnOrdersPage && (
                <Button variant="ghost" asChild>
                  <Link to="/orders">Orders</Link>
                </Button>
              )}
              <Button asChild>
                <Link to="/new">Add Order</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Link>
          </Button>

          {/* Order Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold font-mono">
                      Order #{order.order_number}
                    </h2>
                    <p className="text-xl text-muted-foreground mt-1">
                      {order.customer_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StageBadge stage={order.stage} />
                    <Badge variant="outline">{formatDate(order.order_date)}</Badge>
                    {order.city && <Badge variant="outline">{order.city}</Badge>}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Order
                    </Button>
                  )}
                </div>

                {/* Money Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Advance</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(advanceAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Freight</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(freightAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-lg font-bold text-accent">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stepper with Action */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Card className="sticky top-20 z-10 shadow-lg">
                <CardContent className="pt-6">
                  <OrderStepper currentStage={order.stage} />
                  {order.stage !== "closed" && (
                    <div className="mt-6 flex flex-col items-center gap-2">
                      <Button
                        size="lg"
                        onClick={handleNextStage}
                        disabled={!canMoveToNextStage()}
                      >
                        {getNextStageLabel()}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                      {!canMoveToNextStage() && (
                        <p className="text-sm text-destructive">
                          {order.stage === "assign_site" && "Please select assign site"}
                          {order.stage === "processing" && "Please select processing"}
                        </p>
                      )}
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowForceCloseDialog(true)}
                          className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Close Order Now
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Online Users Sidebar */}
            <div className="md:col-span-1">
              <OnlineUsers orderId={order.id} />
            </div>
          </div>

          {/* Order Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !orderDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {orderDate ? format(orderDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={orderDate}
                        onSelect={setOrderDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Estimated Duration (days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <Separator />

              {/* Financial Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Financial Details</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="total">Total Amount</Label>
                    <CurrencyInput
                      id="total"
                      value={totalAmount}
                      onChange={setTotalAmount}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="advance">Advance Amount</Label>
                    <CurrencyInput
                      id="advance"
                      value={advanceAmount}
                      onChange={setAdvanceAmount}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="freight">Freight Amount</Label>
                    <CurrencyInput
                      id="freight"
                      value={freightAmount}
                      onChange={setFreightAmount}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Calculated Balance:
                    </span>
                    <span className="text-xl font-bold text-accent">
                      {formatCurrency(balance)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Balance = Total - Advance + Freight
                  </p>
                </div>
              </div>

              <Separator />

              {/* Site Assignments */}
              {(order.stage === "assign_site" || order.stage === "processing" || 
                order.stage === "dispatch" || order.stage === "fitting" || order.stage === "closed") && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Site Assignment</h3>
                  <div className="space-y-2">
                    <Label>Assign Site</Label>
                    <RadioGroup
                      value={assignSite}
                      onValueChange={(value) => setAssignSite(value as SiteEnum)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="naka" id="assign-naka" />
                        <Label htmlFor="assign-naka">Naka</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="godown" id="assign-godown" />
                        <Label htmlFor="assign-godown">Godown</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {(order.stage === "processing" || order.stage === "dispatch" || 
                order.stage === "fitting" || order.stage === "closed") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Processing</Label>
                    <RadioGroup
                      value={processingSite}
                      onValueChange={(value) => setProcessingSite(value as SiteEnum)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="naka" id="processing-naka" />
                        <Label htmlFor="processing-naka">Naka</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="godown" id="processing-godown" />
                        <Label htmlFor="processing-godown">Godown</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {(order.stage === "assign_site" || order.stage === "processing" || 
                order.stage === "dispatch" || order.stage === "fitting" || order.stage === "closed") && (
                <Separator />
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Chalan/Glass_Size</Label>
                <p className="text-sm text-muted-foreground">
                  Upload size charts, design specifications, or other documents (optional)
                </p>
                <FileUpload
                  value={files}
                  onChange={setFiles}
                  maxFiles={10}
                  maxSize={10}
                  uploading={uploading}
                  progress={progress}
                  accept="image/*"
                />
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Uploaded Files:</p>
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(file.uploaded_at).toLocaleDateString()} • {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadFile(file.path, file.name)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFile(file, index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No timeline entries yet
                  </p>
                ) : (
                  timeline
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{entry.action}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{entry.user}</span>
                            <span>•</span>
                            <span>{formatTimestamp(entry.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sticky Save Button */}
          <div className="sticky bottom-4 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="mr-2">
                    <LoadingSpinner size="sm" />
                  </div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Close Order Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this order? This action marks the order
              as completed and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseOrder}>
              Close Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force Close Order Dialog */}
      <AlertDialog open={showForceCloseDialog} onOpenChange={setShowForceCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this order now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order as Closed immediately and skip remaining stages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Order Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order #{order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order and all attached chalan images will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OfflineIndicator />
    </div>
  );
};

export default OrderWorkspace;
