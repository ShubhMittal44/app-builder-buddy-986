import { TrendingUp, DollarSign, Clock, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useOrderAnalytics } from '@/hooks/useOrderAnalytics';
import { StageBadge } from '@/components/ui/stage-badge';
import { Progress } from '@/components/ui/progress';

export const AnalyticsDashboard = () => {
  const { orders, loading } = useOrders();
  const { stageMetrics, financialMetrics, timeMetrics, getTopCustomers, getCityDistribution } = 
    useOrderAnalytics(orders);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  const topCustomers = getTopCustomers(5);
  const cityDistribution = getCityDistribution();

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {financialMetrics.totalOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics.totalBalance)}</div>
            <p className="text-xs text-muted-foreground">
              To be collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialMetrics.avgOrderValue)}</div>
            <p className="text-xs text-muted-foreground">
              Per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeMetrics.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {timeMetrics.thisWeek} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Orders by Stage</CardTitle>
          <CardDescription>Distribution of orders across workflow stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stageMetrics.map((metric) => (
              <div key={metric.stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StageBadge stage={metric.stage} />
                    <span className="text-sm font-medium">{metric.count} orders</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(metric.totalAmount)}
                  </span>
                </div>
                <Progress value={metric.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>By total order value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCustomers.map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.count} orders</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(customer.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* City Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by City</CardTitle>
            <CardDescription>Geographic distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cityDistribution.slice(0, 5).map((city) => (
                <div key={city.city} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{city.city}</span>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(city.count / financialMetrics.totalOrders) * 100} 
                      className="h-2 w-24" 
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {city.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
