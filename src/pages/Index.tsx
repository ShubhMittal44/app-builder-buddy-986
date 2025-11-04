import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/stage-badge";
import { Package, ClipboardList, Truck, Wrench, CheckCircle } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">RGH – Order Management</h1>
            <nav className="flex gap-4">
              <Button variant="ghost" asChild>
                <Link to="/orders">Orders</Link>
              </Button>
              <Button asChild>
                <Link to="/new">Add Order</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">Welcome to RGH Order Management</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Streamline your glass installation orders from intake to completion with our
              powerful workflow management system.
            </p>
          </div>

          {/* Workflow Stages */}
          <Card>
            <CardHeader>
              <CardTitle>Order Workflow Stages</CardTitle>
              <CardDescription>
                Track orders through six distinct stages with clear visual indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Package className="w-8 h-8 text-stage-intake" />
                  <div>
                    <StageBadge stage="intake" />
                    <p className="text-sm text-muted-foreground mt-1">Initial order intake</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <ClipboardList className="w-8 h-8 text-stage-assign" />
                  <div>
                    <StageBadge stage="assign" />
                    <p className="text-sm text-muted-foreground mt-1">Assign to site</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Package className="w-8 h-8 text-stage-processing" />
                  <div>
                    <StageBadge stage="processing" />
                    <p className="text-sm text-muted-foreground mt-1">Order processing</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Truck className="w-8 h-8 text-stage-dispatch" />
                  <div>
                    <StageBadge stage="dispatch" />
                    <p className="text-sm text-muted-foreground mt-1">Ready for dispatch</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <Wrench className="w-8 h-8 text-stage-fitting" />
                  <div>
                    <StageBadge stage="fitting" />
                    <p className="text-sm text-muted-foreground mt-1">Installation phase</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <CheckCircle className="w-8 h-8 text-stage-closed" />
                  <div>
                    <StageBadge stage="closed" />
                    <p className="text-sm text-muted-foreground mt-1">Order completed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  Unified Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Single-table architecture with all order and customer data in one place
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <ClipboardList className="w-5 h-5 text-accent" />
                  </div>
                  Real-time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track order progress with automatic timeline logging and status updates
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  Workflow Validation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Stage-specific requirements ensure proper order progression
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/new">
                <Package className="w-5 h-5" />
                Create Your First Order
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Start managing your glass installation orders efficiently
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
