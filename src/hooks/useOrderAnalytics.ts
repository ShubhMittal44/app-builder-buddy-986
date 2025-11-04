import { useMemo } from 'react';
import { Order, OrderStage } from '@/hooks/useOrders';

export interface StageMetrics {
  stage: OrderStage;
  count: number;
  totalAmount: number;
  avgAmount: number;
  percentage: number;
}

export interface FinancialMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalAdvance: number;
  totalFreight: number;
  totalBalance: number;
  avgOrderValue: number;
}

export interface TimeMetrics {
  today: number;
  thisWeek: number;
  thisMonth: number;
  avgDuration: number;
}

export const useOrderAnalytics = (orders: Order[]) => {
  const stageMetrics = useMemo<StageMetrics[]>(() => {
    const stages: OrderStage[] = ['intake', 'assign_site', 'processing', 'dispatch', 'fitting', 'closed'];
    const totalOrders = orders.length;

    return stages.map(stage => {
      const stageOrders = orders.filter(o => o.stage === stage);
      const totalAmount = stageOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

      return {
        stage,
        count: stageOrders.length,
        totalAmount,
        avgAmount: stageOrders.length > 0 ? totalAmount / stageOrders.length : 0,
        percentage: totalOrders > 0 ? (stageOrders.length / totalOrders) * 100 : 0,
      };
    });
  }, [orders]);

  const financialMetrics = useMemo<FinancialMetrics>(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalAdvance = orders.reduce((sum, o) => sum + (o.advance_amount || 0), 0);
    const totalFreight = orders.reduce((sum, o) => sum + (o.freight_amount || 0), 0);
    const totalBalance = orders.reduce((sum, o) => {
      const balance = (o.total_amount || 0) - (o.advance_amount || 0) + (o.freight_amount || 0);
      return sum + balance;
    }, 0);

    return {
      totalOrders: orders.length,
      totalRevenue,
      totalAdvance,
      totalFreight,
      totalBalance,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    };
  }, [orders]);

  const timeMetrics = useMemo<TimeMetrics>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const todayOrders = orders.filter(o => new Date(o.order_date) >= today).length;
    const weekOrders = orders.filter(o => new Date(o.order_date) >= weekAgo).length;
    const monthOrders = orders.filter(o => new Date(o.order_date) >= monthAgo).length;

    // Calculate average duration for completed orders
    const completedOrders = orders.filter(o => o.stage === 'closed' && o.estimated_duration);
    const avgDuration = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => sum + (o.estimated_duration || 0), 0) / completedOrders.length
      : 0;

    return {
      today: todayOrders,
      thisWeek: weekOrders,
      thisMonth: monthOrders,
      avgDuration,
    };
  }, [orders]);

  const getTopCustomers = (limit: number = 5) => {
    const customerMap = new Map<string, { count: number; total: number }>();

    orders.forEach(order => {
      const existing = customerMap.get(order.customer_name) || { count: 0, total: 0 };
      customerMap.set(order.customer_name, {
        count: existing.count + 1,
        total: existing.total + (order.total_amount || 0),
      });
    });

    return Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  };

  const getCityDistribution = () => {
    const cityMap = new Map<string, number>();

    orders.forEach(order => {
      if (order.city) {
        cityMap.set(order.city, (cityMap.get(order.city) || 0) + 1);
      }
    });

    return Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    stageMetrics,
    financialMetrics,
    timeMetrics,
    getTopCustomers,
    getCityDistribution,
  };
};
