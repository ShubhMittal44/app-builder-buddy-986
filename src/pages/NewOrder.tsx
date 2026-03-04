import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Plus, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FileUpload } from "@/components/ui/file-upload";
import { OrderStepper } from "@/components/OrderStepper";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useOrderMutations } from "@/hooks/useOrders";
import { LoadingSpinner } from "@/components/LoadingStates";
import { useFileUpload, UploadedFile } from "@/hooks/useFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const NewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { createOrder } = useOrderMutations();
  const { uploadFiles, uploading, progress } = useFileUpload();
  const [customerName, setCustomerName] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lucknow");
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [freightAmount, setFreightAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const balance = totalAmount - advanceAmount + freightAmount;
  const isOnOrdersPage = location.pathname === '/orders' || 
                         location.pathname.startsWith('/orders/') || 
                         location.pathname === '/new';

  // Fetch customer suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!customerName || customerName.length < 2) {
        setSuggestions([]);
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select('customer_name, phone, address, city')
        .ilike('customer_name', `%${customerName}%`)
        .limit(10);

      if (data) {
        // Get unique customers
        const uniqueCustomers = Array.from(
          new Map(data.map(item => [item.customer_name, item])).values()
        );
        setSuggestions(uniqueCustomers);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [customerName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    try {
      // First create the order
      const newOrder = await createOrder({
        customer_name: customerName,
        phone: phone || null,
        address: address || null,
        city: city || null,
        order_date: format(orderDate, 'yyyy-MM-dd'),
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : null,
        total_amount: totalAmount || null,
        advance_amount: advanceAmount || null,
        freight_amount: freightAmount || null,
        notes: notes || null,
        files: [],
      });

      // Upload files if any
      if (files.length > 0) {
        const uploadedFiles = await uploadFiles(files, newOrder.id);
        
        // Update order with file metadata
        if (uploadedFiles.length > 0) {
          await supabase
            .from('orders')
            .update({ files: uploadedFiles as any })
            .eq('id', newOrder.id);
        }
      }

      navigate(`/orders/${newOrder.id}`);
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm hidden md:block">
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
            </nav>
          </div>
        </div>
      </header>
      
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm md:hidden">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-primary text-center">Add Order</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Link>
          </Button>

          {/* Stepper */}
          <Card>
            <CardContent className="pt-6">
              <OrderStepper currentStage="intake" />
            </CardContent>
          </Card>

          {/* Page Title */}
          <div>
            <h2 className="text-3xl font-bold">Create New Order</h2>
            <p className="text-muted-foreground mt-1">
              Enter customer and order details to begin the workflow
            </p>
          </div>

          {/* Order Form */}
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 relative">
                    <Label htmlFor="customerName">
                      Customer Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="Enter customer name"
                      required
                      autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-auto">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0"
                            onClick={() => {
                              setCustomerName(suggestion.customer_name);
                              setPhone(suggestion.phone || "");
                              setAddress(suggestion.address || "");
                              setCity(suggestion.city || "Lucknow");
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="font-medium">{suggestion.customer_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {suggestion.phone} • {suggestion.address} • {suggestion.city}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
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
                          {orderDate ? (
                            format(orderDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={orderDate}
                          onSelect={(date) => date && setOrderDate(date)}
                          initialFocus
                          className="pointer-events-auto"
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
                      placeholder="5"
                      min="1"
                    />
                  </div>
                </div>

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
                        ₹{balance.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance = Total - Advance + Freight
                    </p>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes or special requirements"
                    rows={4}
                  />
                </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Chalan/Glass_Size</Label>
                <p className="text-sm text-muted-foreground">
                  Upload size charts, design specs, or other documents
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
              </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" asChild disabled={submitting}>
                <Link to="/">Cancel</Link>
              </Button>
              <Button type="submit" disabled={!customerName.trim() || submitting || uploading}>
                {submitting || uploading ? (
                  <>
                    <div className="mr-2">
                      <LoadingSpinner size="sm" />
                    </div>
                    {uploading ? 'Uploading files...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Order
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
      
      <MobileBottomNav />
      <OfflineIndicator />
    </div>
  );
};

export default NewOrder;
