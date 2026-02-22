import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ArrowLeft } from "lucide-react";
import { StaffTab } from "@/components/staff-management/StaffTab";
import { VehicleTab } from "@/components/staff-management/VehicleTab";
import { OtherTab } from "@/components/staff-management/OtherTab";

const StaffManagement = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="staff"><StaffTab /></TabsContent>
          <TabsContent value="vehicle"><VehicleTab /></TabsContent>
          <TabsContent value="other"><OtherTab /></TabsContent>
        </Tabs>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default StaffManagement;
