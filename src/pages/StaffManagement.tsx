import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { StaffTab } from "@/components/staff-management/StaffTab";
import { VehicleTab } from "@/components/staff-management/VehicleTab";
import { OtherTab } from "@/components/staff-management/OtherTab";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

const LS_KEY = "staff_management_default_date";

const StaffManagement = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");
  const [defaultDate, setDefaultDate] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved || format(new Date(), "yyyy-MM-dd");
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, defaultDate);
  }, [defaultDate]);

  const resetToToday = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setDefaultDate(today);
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-10 border-b bg-card shadow-sm hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
              </Button>
              <h1 className="text-2xl font-bold text-primary">Staff Management</h1>
            </div>
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

      <main className="container mx-auto px-4 py-6">
        {/* Default Date Selector */}
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border bg-card">
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium">Default Date</Label>
            <Input
              type="date"
              value={defaultDate}
              onChange={e => setDefaultDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button variant="outline" size="sm" onClick={resetToToday}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset to Today
          </Button>
          <span className="text-xs text-muted-foreground">New entries will use this date by default.</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="staff"><StaffTab defaultDate={defaultDate} /></TabsContent>
          <TabsContent value="vehicle"><VehicleTab defaultDate={defaultDate} /></TabsContent>
          <TabsContent value="other"><OtherTab defaultDate={defaultDate} /></TabsContent>
        </Tabs>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default StaffManagement;
