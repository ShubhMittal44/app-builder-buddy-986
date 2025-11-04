import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, ChevronRight, FileIcon, Download } from "lucide-react";
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
import { mockOrders } from "@/lib/mock-data";
import { toast } from "@/hooks/use-toast";
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

const OrderWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = mockOrders.find((o) => o.id === id);

  const [customerName, setCustomerName] = useState(order?.customerName || "");
  const [phone, setPhone] = useState(order?.phone || "");
  const [address, setAddress] = useState(order?.address || "");
  const [city, setCity] = useState(order?.city || "");
  const [totalAmount, setTotalAmount] = useState(order?.totalAmount || 0);
  const [advanceAmount, setAdvanceAmount] = useState(order?.advanceAmount || 0);
  const [freightAmount, setFreightAmount] = useState(order?.freightAmount || 0);
  const [notes, setNotes] = useState(order?.notes || "");
  const [assignSite, setAssignSite] = useState(order?.assignSite || "");
  const [processingSite, setProcessingSite] = useState(order?.processingSite || "");
  const [files, setFiles] = useState<File[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Order Not Found</h2>
          <Button asChild>
            <Link to="/">Back to Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const balance = totalAmount - advanceAmount + freightAmount;

  const canMoveToNextStage = () => {
    switch (order.stage) {
      case "intake":
        return true;
      case "assign":
        return assignSite !== "";
      case "processing":
        return processingSite !== "";
      case "dispatch":
        return order.files.length > 0 || files.length > 0;
      case "fitting":
        return true;
      default:
        return false;
    }
  };

  const getNextStageLabel = () => {
    switch (order.stage) {
      case "intake":
        return "Move to Assign Site";
      case "assign":
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

  const handleNextStage = () => {
    if (order.stage === "fitting") {
      setShowCloseDialog(true);
      return;
    }

    toast({
      title: "Stage Updated",
      description: `Order moved to ${getNextStageLabel()}`,
    });
  };

  const handleCloseOrder = () => {
    toast({
      title: "Order Closed",
      description: "Order has been successfully completed",
    });
    setShowCloseDialog(false);
    navigate("/");
  };

  const handleSave = () => {
    toast({
      title: "Changes Saved",
      description: "Order details have been updated",
    });
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
              <Button variant="ghost" asChild>
                <Link to="/">Orders</Link>
              </Button>
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
                      Order #{order.orderNumber}
                    </h2>
                    <p className="text-xl text-muted-foreground mt-1">
                      {order.customerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StageBadge stage={order.stage} />
                    <Badge variant="outline">{formatDate(order.orderDate)}</Badge>
                    {order.city && <Badge variant="outline">{order.city}</Badge>}
                  </div>
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
          <Card className="sticky top-20 z-10 shadow-lg">
            <CardContent className="pt-6">
              <OrderStepper currentStage={order.stage} />
              {order.stage !== "closed" && (
                <div className="mt-6 flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleNextStage}
                    disabled={!canMoveToNextStage()}
                  >
                    {getNextStageLabel()}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                  {!canMoveToNextStage() && (
                    <p className="text-sm text-destructive mt-2">
                      Complete required fields to proceed
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name</Label>
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
              </div>

              {/* Financial Information */}
              <Separator />
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
              </div>

              {/* Site Assignment */}
              {(order.stage === "assign" ||
                order.stage === "processing" ||
                order.stage === "dispatch" ||
                order.stage === "fitting" ||
                order.stage === "closed") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Site Assignment</h3>
                    <RadioGroup value={assignSite} onValueChange={setAssignSite}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="naka" id="naka" />
                        <Label htmlFor="naka">Naka</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="godown" id="godown" />
                        <Label htmlFor="godown">Godown</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              {/* Processing Site */}
              {(order.stage === "processing" ||
                order.stage === "dispatch" ||
                order.stage === "fitting" ||
                order.stage === "closed") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Processing Site</h3>
                    <RadioGroup
                      value={processingSite}
                      onValueChange={setProcessingSite}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="naka" id="proc-naka" />
                        <Label htmlFor="proc-naka">Naka</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="godown" id="proc-godown" />
                        <Label htmlFor="proc-godown">Godown</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              {/* Notes */}
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Files */}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Files</h3>
                {order.files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Existing Files</Label>
                    <div className="space-y-2">
                      {order.files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <FileIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 text-sm">{file}</span>
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Upload New Files</Label>
                  <FileUpload value={files} onChange={setFiles} />
                </div>
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
                {order.timeline.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {index < order.timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-medium">{entry.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.user} • {formatTimestamp(entry.timestamp)}
                      </p>
                      {entry.fromStage && entry.toStage && (
                        <div className="flex items-center gap-2 mt-2">
                          <StageBadge stage={entry.fromStage} />
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          <StageBadge stage={entry.toStage} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="sticky bottom-4 flex justify-end">
            <Button size="lg" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </main>

      {/* Close Order Confirmation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this order? This action marks the
              order as completed and cannot be undone.
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
    </div>
  );
};

export default OrderWorkspace;
